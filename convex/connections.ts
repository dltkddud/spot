import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { record } from "./activity";

async function row(ctx: MutationCtx, userId: Id<"users">, otherId: Id<"users">) {
  return await ctx.db
    .query("connections")
    .withIndex("by_user_and_other", (q) => q.eq("userId", userId).eq("otherId", otherId))
    .unique();
}

// Connects two people both ways. Returns false if they were already connected.
export async function connect(
  ctx: MutationCtx,
  eventId: Id<"events">,
  a: Id<"users">,
  b: Id<"users">,
  source: Doc<"connections">["source"],
) {
  if (a === b || (await row(ctx, a, b))) return false;
  const createdAt = Date.now();
  await ctx.db.insert("connections", { eventId, userId: a, otherId: b, source, createdAt });
  if (!(await row(ctx, b, a))) await ctx.db.insert("connections", { eventId, userId: b, otherId: a, source, createdAt });
  await record(ctx, eventId, "connection_made", a, b);
  return true;
}
