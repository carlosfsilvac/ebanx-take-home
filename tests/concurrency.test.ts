import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Bank } from "../src/domain/bank.js";
import { buildApp } from "../src/http/app.js";

// Requests are fired together, so they interleave inside Fastify's async
// pipeline. The Bank calls themselves are synchronous, which is what keeps
// each read-check-write atomic (see "Concurrency" in the README).
describe("concurrent requests", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp(new Bank());
    await app.ready();
  });

  afterEach(() => app.close());

  function postEvent(event: object) {
    return app.inject({ method: "POST", url: "/event", payload: event });
  }

  async function balanceOf(accountId: string): Promise<number> {
    const res = await app.inject({
      method: "GET",
      url: "/balance",
      query: { account_id: accountId },
    });
    return Number(res.body);
  }

  it("applies every deposit and withdraw exactly once", async () => {
    await postEvent({ type: "deposit", destination: "100", amount: 1000 });

    const deposits = Array.from({ length: 500 }, () =>
      postEvent({ type: "deposit", destination: "100", amount: 1 }),
    );
    const withdraws = Array.from({ length: 300 }, () =>
      postEvent({ type: "withdraw", origin: "100", amount: 1 }),
    );
    const responses = await Promise.all([...deposits, ...withdraws]);

    expect(responses.every((res) => res.statusCode === 201)).toBe(true);
    expect(await balanceOf("100")).toBe(1000 + 500 - 300);
  });

  it("never spends the same balance twice", async () => {
    await postEvent({ type: "deposit", destination: "100", amount: 100 });

    const responses = await Promise.all(
      Array.from({ length: 200 }, () =>
        postEvent({ type: "withdraw", origin: "100", amount: 1 }),
      ),
    );
    const statuses = responses.map((res) => res.statusCode);

    expect(statuses.filter((status) => status === 201)).toHaveLength(100);
    expect(statuses.filter((status) => status === 422)).toHaveLength(100);
    expect(await balanceOf("100")).toBe(0);
  });

  it("keeps the total amount of money constant across transfers", async () => {
    await postEvent({ type: "deposit", destination: "100", amount: 50 });
    await postEvent({ type: "deposit", destination: "300", amount: 50 });

    await Promise.all(
      Array.from({ length: 200 }, (_, i) =>
        postEvent(
          i % 2 === 0
            ? { type: "transfer", origin: "100", destination: "300", amount: 3 }
            : {
                type: "transfer",
                origin: "300",
                destination: "100",
                amount: 2,
              },
        ),
      ),
    );
    const a = await balanceOf("100");
    const b = await balanceOf("300");

    expect(a + b).toBe(100);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
  });
});
