import Fastify, { type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import {
  type Account,
  type Bank,
  type TransferResult,
} from "../domain/bank.js";
import {
  AccountNotFoundError,
  InsufficientFundsError,
  InvalidAmountError,
  SameAccountTransferError,
} from "../domain/errors.js";
import { balanceQuerySchema, type Event, eventSchema } from "./schemas.js";

type EventResponse =
  { destination: Account } | { origin: Account } | TransferResult;

export function buildApp(bank: Bank, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  // Clients often send `Content-Type: application/json` with no body on
  // POST /reset; Fastify rejects that by default, so treat it as no body.
  const parseJson = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      const text = body.toString();
      if (text === "") {
        done(null, undefined);
        return;
      }
      parseJson(request, text, done);
    },
  );

  app.post("/reset", async () => {
    bank.reset();
    return "OK";
  });

  app.get("/balance", async (request) => {
    const { account_id } = balanceQuerySchema.parse(request.query);
    return String(bank.balance(account_id));
  });

  app.post("/event", async (request, reply) => {
    const event = eventSchema.parse(request.body);
    return reply.code(201).send(applyEvent(bank, event));
  });

  // The single place where errors become HTTP responses. Every error body is
  // "0", the same shape the spec uses for a missing account.
  app.setErrorHandler((error, request, reply) => {
    const status = statusFor(error);
    if (status >= 500) {
      request.log.error(error);
    }
    return reply.code(status).type("text/plain").send("0");
  });

  return app;
}

function applyEvent(bank: Bank, event: Event): EventResponse {
  switch (event.type) {
    case "deposit":
      return { destination: bank.deposit(event.destination, event.amount) };
    case "withdraw":
      return { origin: bank.withdraw(event.origin, event.amount) };
    case "transfer":
      return bank.transfer(event.origin, event.destination, event.amount);
    default: {
      // Compile-time guard: a new event type must be handled above.
      const unhandled: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(unhandled)}`);
    }
  }
}

function statusFor(error: unknown): number {
  if (error instanceof AccountNotFoundError) return 404;
  if (error instanceof InsufficientFundsError) return 422;
  if (
    error instanceof InvalidAmountError ||
    error instanceof SameAccountTransferError ||
    error instanceof ZodError
  ) {
    return 400;
  }
  // Fastify's own client errors, such as malformed JSON, keep their status.
  if (hasClientErrorStatus(error)) return error.statusCode;
  return 500;
}

function hasClientErrorStatus(error: unknown): error is { statusCode: number } {
  if (typeof error !== "object" || error === null) return false;
  const { statusCode } = error as { statusCode?: unknown };
  return (
    typeof statusCode === "number" && statusCode >= 400 && statusCode < 500
  );
}
