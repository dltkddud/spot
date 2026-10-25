import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { DEMO_ALWAYS_FRESH, DEMO_ALWAYS_STALE } from "../src/lib/mockData";

const MIN = 60_000;
// How long Jimin shows "Asked Jimin to confirm" before "Still here?" comes back.
const ASKED_RESET_MIN = 2;
// Jimin's last update is always at least this long ago (over the 15-minute rule).
const STALE_FOR_MIN = 40;

async function participationsOf(ctx: MutationCtx, seedKey: string) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_seed_key", (q) => q.eq("seedKey", seedKey))
    .first();
  if (!profile) return [];
  return await ctx.db
    .query("users")
    .withIndex("by_profile_and_event", (q) => q.eq("profileId", profile._id))
    .take(10);
}

// Runs every minute (crons.ts) so the demo guests show both sides of the
// 15-minute rule: Logan is always fresh, Jimin always stale. Jimin can't answer
// "Still here?", so the question clears after a couple of minutes to be asked again.
export const keepTimes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const key of DEMO_ALWAYS_FRESH) {
      for (const u of await participationsOf(ctx, key)) {
        if (u.zoneId) await ctx.db.patch("users", u._id, { updatedAt: now, stillHereAskedAt: undefined });
      }
    }
    for (const key of DEMO_ALWAYS_STALE) {
      for (const u of await participationsOf(ctx, key)) {
        // Something touched him (e.g. admin.resetActivity): back to over 15 minutes.
        if (now - u.updatedAt < STALE_FOR_MIN * MIN) await ctx.db.patch("users", u._id, { updatedAt: now - STALE_FOR_MIN * MIN });
        if (u.stillHereAskedAt !== undefined && now - u.stillHereAskedAt >= ASKED_RESET_MIN * MIN) {
          await ctx.db.patch("users", u._id, { stillHereAskedAt: undefined });
        }
      }
    }
    return null;
  },
});
