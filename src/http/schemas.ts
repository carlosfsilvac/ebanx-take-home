import { z } from "zod";

const accountId = z.string().min(1);

// Only the type is checked here: the amount rule (positive safe integer)
// belongs to the domain, so it is not duplicated at the HTTP boundary.
const amount = z.number();

export const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("deposit"), destination: accountId, amount }),
  z.object({ type: z.literal("withdraw"), origin: accountId, amount }),
  z.object({
    type: z.literal("transfer"),
    origin: accountId,
    destination: accountId,
    amount,
  }),
]);

export type Event = z.infer<typeof eventSchema>;

export const balanceQuerySchema = z.object({ account_id: accountId });
