# EBANX Take-home — Bank Account API

In-memory HTTP API for bank account events (deposit, withdraw, transfer), built
with TypeScript, Node.js, Fastify and Zod.

## Running

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # development server with reload, on http://localhost:3000
```

For a production-like run:

```bash
npm run build      # compile TypeScript to dist/
npm start          # run dist/server.js
```

The port defaults to `3000` and can be changed with the `PORT` environment
variable.

## Testing and checks

```bash
npm test           # Vitest: domain, HTTP API and concurrency tests
npm run lint       # ESLint + Prettier check
npm run typecheck  # tsc on src and tests (Vitest does not type-check)
```

The HTTP tests use Fastify's `inject`, so they exercise the full request
pipeline without opening a port. `tests/api.test.ts` replays the steps of the
EBANX automated test suite in order.

## API

| Method | Path                        | Success                                  |
| ------ | --------------------------- | ---------------------------------------- |
| POST   | `/reset`                    | `200`, body `OK`                         |
| GET    | `/balance?account_id=<id>`  | `200`, body is the balance, e.g. `20`    |
| POST   | `/event` (JSON body, below) | `201`, JSON with the affected account(s) |

Event bodies:

```jsonc
{ "type": "deposit", "destination": "100", "amount": 10 }
// 201 {"destination":{"id":"100","balance":10}}

{ "type": "withdraw", "origin": "100", "amount": 5 }
// 201 {"origin":{"id":"100","balance":5}}

{ "type": "transfer", "origin": "100", "destination": "300", "amount": 5 }
// 201 {"origin":{"id":"100","balance":0},"destination":{"id":"300","balance":5}}
```

A deposit, or the destination of a transfer, creates the account if it does
not exist.

### Errors

Every error responds with the plain-text body `0`, the same shape the spec uses
for a missing account; the status code carries the meaning.

| Status | When                                                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| `400`  | Invalid input: malformed JSON, unknown type, missing or mistyped field, invalid amount, transfer to the same account |
| `404`  | The account (balance query, withdraw or transfer origin) does not exist                                              |
| `422`  | Insufficient funds                                                                                                   |
| `500`  | Unexpected error (logged)                                                                                            |

## Project structure

```text
src/
  domain/
    bank.ts       Bank: in-memory balances and the business rules
    errors.ts     Domain errors (not found, insufficient funds, ...)
  http/
    app.ts        buildApp(bank): routes and error-to-status translation
    schemas.ts    Zod schemas for the event body and the balance query
  server.ts       Starts the server
tests/
  bank.test.ts         Domain rules
  api.test.ts          HTTP contract, including the EBANX suite steps
  concurrency.test.ts  Parallel requests keep balances consistent
```

The domain knows nothing about HTTP: `Bank` takes plain arguments and throws
domain errors. The HTTP layer validates input, calls the `Bank` and translates
its errors into status codes in a single error handler. `buildApp` receives the
`Bank`, so every test gets an isolated instance.

## Decisions

Where the spec is silent, the simplest consistent option was chosen:

- **Amounts** must be integers greater than zero and within
  `Number.MAX_SAFE_INTEGER` (beyond it a JavaScript number cannot represent
  every integer). Zero, negative, decimal, NaN and non-number values return
  `400`. The rule lives only in the domain; Zod checks only that `amount` is a
  number, so the rule is not duplicated.
- **Account ids** are non-empty strings; a number in place of a string is
  invalid. Unknown extra fields in the body are ignored.
- **Balances never go negative**: a withdraw or transfer larger than the
  balance fails with `422` and changes nothing.
- **Transfer to the same account** is rejected with `400`.
- **Validation order**: input is checked before any account lookup, so an
  invalid amount returns `400` even for a missing account. Nothing is written
  until every check has passed, so a failed operation never creates an account
  or changes a balance.
- **Atomic transfer**: `transfer` reuses `withdraw` and `deposit`. Every check
  that can fail runs before the first write, and the synchronous code cannot be
  interleaved, so a transfer either fully happens or changes nothing — no
  rollback needed.
- **Reads have no side effects**: `GET /balance` never creates an account.
- **Empty JSON body**: some clients send `Content-Type: application/json` with
  no body on `POST /reset`. Fastify rejects that by default, so the JSON parser
  treats an empty body as no body (still using Fastify's safe parser
  otherwise).

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

## Idempotency

`GET /balance` and `POST /reset` are idempotent: repeating them leaves the same
state. `POST /event` is not: retrying a deposit after a timeout deposits twice.
The spec does not ask for it, so it is not implemented. In a real payment API
the client would send an `Idempotency-Key` header; the server stores the key
with the response of the first request and, for a repeated key, returns the
stored response instead of applying the event again (reserving the key before
processing, so two concurrent retries cannot both run).

## Publishing for the EBANX test suite

The suite needs a public URL. Run the server locally and expose it with a
[Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/),
which needs no account:

```bash
npm run build && npm start
```

In another terminal:

```bash
cloudflared tunnel --url http://localhost:3000
```

Then give the printed `https://<random>.trycloudflare.com` URL to the test
suite. Any tunnel works the same way, e.g. `ngrok http 3000`.

## Limitations

- State is in memory and lost on restart; durability is not a requirement.
- Single process only: running several instances would give each its own
  state.
- Balances are JavaScript numbers; a balance that grows beyond
  `Number.MAX_SAFE_INTEGER` through many deposits is not guarded against.
- No authentication, transaction history or idempotency keys, since the spec
  does not ask for them.
