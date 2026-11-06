# EBANX Take-home — Bank Account API

In-memory HTTP API for bank account events (deposit, withdraw, transfer), built with
TypeScript and Node.js.

## Requirements

- Node.js 22+

## Scripts

```bash
npm install
npm test        # run the test suite
npm run lint    # ESLint + Prettier check
npm run build   # compile to dist/
```

## Concurrency

Node.js runs JavaScript on a single thread. Every `Bank` operation is
synchronous: it reads, checks and writes the balance without an `await` in
between, so no other request can run in the middle of it. Each operation is
therefore atomic by construction, and the lost-update race that needs a lock in
Java or C# cannot happen here. `tests/concurrency.test.ts` fires hundreds of
concurrent requests and checks that every deposit and withdraw is applied
exactly once, that a balance is never spent twice, and that transfers keep the
total amount of money constant.

This stops being true as soon as the state moves to an asynchronous store (a
database, Redis): with an `await` between reading and writing, two requests can
read the same balance and both write based on it. At that point each operation
needs one of:

- a per-account mutex (only works within a single process);
- a database transaction with row locks (`SELECT ... FOR UPDATE`), locking the
  accounts of a transfer in a fixed order to avoid deadlocks;
- optimistic locking: a `version` column checked on write, retrying on
  conflict.

None of these is implemented because the spec keeps state in memory, and adding
a lock to synchronous code would only add complexity without fixing anything.
