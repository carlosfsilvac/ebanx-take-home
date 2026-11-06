import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Bank } from "../src/domain/bank.js";
import { buildApp } from "../src/http/app.js";

function postEvent(app: FastifyInstance, event: unknown) {
  return app.inject({
    method: "POST",
    url: "/event",
    payload: event as object,
  });
}

function getBalance(app: FastifyInstance, accountId: string) {
  return app.inject({
    method: "GET",
    url: "/balance",
    query: { account_id: accountId },
  });
}

// Mirrors the EBANX automated suite: the steps share state and run in order.
describe("EBANX automated test suite", () => {
  const app = buildApp(new Bank());

  beforeAll(() => app.ready());

  it("resets state before starting", async () => {
    const res = await app.inject({ method: "POST", url: "/reset" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("OK");
  });

  it("gets the balance of a non-existing account", async () => {
    const res = await getBalance(app, "1234");

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("0");
  });

  it("creates an account with an initial balance", async () => {
    const res = await postEvent(app, {
      type: "deposit",
      destination: "100",
      amount: 10,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ destination: { id: "100", balance: 10 } });
  });

  it("deposits into an existing account", async () => {
    const res = await postEvent(app, {
      type: "deposit",
      destination: "100",
      amount: 10,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ destination: { id: "100", balance: 20 } });
  });

  it("gets the balance of an existing account", async () => {
    const res = await getBalance(app, "100");

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("20");
  });

  it("withdraws from a non-existing account", async () => {
    const res = await postEvent(app, {
      type: "withdraw",
      origin: "200",
      amount: 10,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("0");
  });

  it("withdraws from an existing account", async () => {
    const res = await postEvent(app, {
      type: "withdraw",
      origin: "100",
      amount: 5,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ origin: { id: "100", balance: 15 } });
  });

  it("transfers from an existing account", async () => {
    const res = await postEvent(app, {
      type: "transfer",
      origin: "100",
      amount: 15,
      destination: "300",
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      origin: { id: "100", balance: 0 },
      destination: { id: "300", balance: 15 },
    });
  });

  it("transfers from a non-existing account", async () => {
    const res = await postEvent(app, {
      type: "transfer",
      origin: "200",
      amount: 15,
      destination: "300",
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toBe("0");
  });
});

describe("HTTP API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp(new Bank());
    await app.ready();
  });

  afterEach(() => app.close());

  it("responds to plain text endpoints with text/plain", async () => {
    await postEvent(app, { type: "deposit", destination: "100", amount: 10 });

    const res = await getBalance(app, "100");

    expect(res.headers["content-type"]).toMatch(/^text\/plain/);
  });

  it("does not change state when reading a balance", async () => {
    await postEvent(app, { type: "deposit", destination: "100", amount: 10 });

    await getBalance(app, "100");
    await getBalance(app, "999");

    expect((await getBalance(app, "100")).body).toBe("10");
    expect((await getBalance(app, "999")).statusCode).toBe(404);
  });

  it("clears every account on reset", async () => {
    await postEvent(app, { type: "deposit", destination: "100", amount: 10 });

    await app.inject({ method: "POST", url: "/reset" });

    expect((await getBalance(app, "100")).statusCode).toBe(404);
  });

  it("accepts reset with an empty JSON body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reset",
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("OK");
  });

  it("returns 400 when account_id is missing", async () => {
    const res = await app.inject({ method: "GET", url: "/balance" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe("0");
  });

  it("returns 422 on insufficient funds and keeps the balance", async () => {
    await postEvent(app, { type: "deposit", destination: "100", amount: 10 });

    const res = await postEvent(app, {
      type: "withdraw",
      origin: "100",
      amount: 11,
    });

    expect(res.statusCode).toBe(422);
    expect(res.body).toBe("0");
    expect((await getBalance(app, "100")).body).toBe("10");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/event",
      headers: { "content-type": "application/json" },
      payload: '{"type":',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe("0");
  });

  it.each([
    ["missing body", undefined],
    ["unknown type", { type: "refund", destination: "100", amount: 10 }],
    ["missing type", { destination: "100", amount: 10 }],
    ["missing destination", { type: "deposit", amount: 10 }],
    ["missing origin", { type: "withdraw", amount: 10 }],
    ["missing amount", { type: "deposit", destination: "100" }],
    ["amount as string", { type: "deposit", destination: "100", amount: "10" }],
    ["amount as null", { type: "deposit", destination: "100", amount: null }],
    [
      "amount as boolean",
      { type: "deposit", destination: "100", amount: true },
    ],
    ["zero amount", { type: "deposit", destination: "100", amount: 0 }],
    ["negative amount", { type: "deposit", destination: "100", amount: -5 }],
    ["decimal amount", { type: "deposit", destination: "100", amount: 1.5 }],
    ["numeric account id", { type: "deposit", destination: 100, amount: 10 }],
    ["empty account id", { type: "deposit", destination: "", amount: 10 }],
    [
      "transfer to the same account",
      { type: "transfer", origin: "100", destination: "100", amount: 5 },
    ],
  ])("returns 400 for an invalid event: %s", async (_label, event) => {
    await postEvent(app, { type: "deposit", destination: "100", amount: 10 });

    const res = await postEvent(app, event);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe("0");
    expect((await getBalance(app, "100")).body).toBe("10");
  });
});
