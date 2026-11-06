import { Bank } from "./domain/bank.js";
import { buildApp } from "./http/app.js";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp(new Bank(), { logger: true });

// 0.0.0.0 so the server is reachable through a tunnel or container, not
// only from localhost.
await app.listen({ port, host: "0.0.0.0" });
