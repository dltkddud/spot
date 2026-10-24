import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { LEAVE_WARNING_MIN } from "../src/lib/time";

const MIN = 60_000;

async function activeRequests(ctx: MutationCtx, panelId: Id<"users">) {
  const waiting = await ctx.db
    .query("chatRequests")
    .withIndex("by_panel_status", (q) => q.eq("panelId", panelId).eq("status", "waiting"))
    .take(500);
  const accepted = await ctx.db
    .query("chatRequests")
    .withIndex("by_panel_status", (q) => q.eq("panelId", panelId).eq("status", "accepted"))
    .take(500);
  return [...waiting, ...accepted];
}

// Call after setting a speaker's leavingAt. Older jobs see a different
// leavingAt when they run and do nothing, so changing or cancelling is safe.
export async function scheduleLeaving(ctx: MutationCtx, userId: Id<"users">, leavingAt: number) {
  const warnAt = Math.max(Date.now(), leavingAt - LEAVE_WARNING_MIN * MIN);
  await ctx.scheduler.runAt(warnAt, internal.leaving.warn, { userId, leavingAt });
  await ctx.scheduler.runAt(leavingAt, internal.leaving.leave, { userId, leavingAt });
}

async function stillLeavingAt(ctx: MutationCtx, userId: Id<"users">, leavingAt: number) {
  const user = await ctx.db.get("users", userId);
  return user && user.status === "leaving" && user.leavingAt === leavingAt ? user : null;
}

// 10 minutes before: mark everyone in line so their app shows the heads-up.
export const warn = internalMutation({
  args: { userId: v.id("users"), leavingAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, leavingAt }) => {
    if (!(await stillLeavingAt(ctx, userId, leavingAt))) return null;
    for (const r of await activeRequests(ctx, userId)) {
      if (r.leaveWarnedFor !== leavingAt) await ctx.db.patch("chatRequests", r._id, { leaveWarnedFor: leavingAt });
    }
    return null;
  },
});

// At leavingAt: open requests become missed, the speaker is hidden and their zone cleared.
export const leave = internalMutation({
  args: { userId: v.id("users"), leavingAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, leavingAt }) => {
    if (!(await stillLeavingAt(ctx, userId, leavingAt))) return null;
    for (const r of await activeRequests(ctx, userId)) {
      await ctx.db.patch("chatRequests", r._id, { status: "missed" });
    }
    await ctx.db.patch("users", userId, { visible: false, zoneId: undefined, updatedAt: Date.now() });
    return null;
  },
});
