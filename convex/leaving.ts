import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { LEAVE_WARNING_MIN } from "../src/lib/time";
import { dissolveAllFor } from "./huddles";
import { cancelMatchesFor } from "./matches";

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

// A speaker's line closes, because they left or stopped being a speaker:
// huddles break up, everyone still waiting or called up is marked missed, and
// each of them gets a follow-up message drafted (shown with the speaker's LinkedIn).
export async function closeLine(ctx: MutationCtx, panelId: Id<"users">) {
  await dissolveAllFor(ctx, panelId);
  for (const r of await activeRequests(ctx, panelId)) {
    await ctx.db.patch("chatRequests", r._id, { status: "missed", closedBecause: "speaker_left" });
    await ctx.scheduler.runAfter(0, internal.followUpsNode.draft, { requestId: r._id });
  }
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

// At leavingAt: huddles break up, open requests become missed, open 10-min chats are
// cancelled, the speaker is hidden and their zone cleared.
export const leave = internalMutation({
  args: { userId: v.id("users"), leavingAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, leavingAt }) => {
    if (!(await stillLeavingAt(ctx, userId, leavingAt))) return null;
    await closeLine(ctx, userId);
    await cancelMatchesFor(ctx, userId);
    await ctx.db.patch("users", userId, {
      visible: false,
      shareWith: "nobody",
      zoneId: undefined,
      stillHereAskedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Demo control: a speaker I'm waiting for leaves right now, so the missed
// request, LinkedIn and follow-up message can be shown without waiting.
export const demoLeaveNow = mutation({
  args: { attendeeId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { attendeeId }) => {
    const mine = await ctx.db
      .query("chatRequests")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
      .take(200);
    const req = mine.find((r) => r.status === "waiting" || r.status === "accepted");
    if (!req) throw new ConvexError("Send a chat request first, then try this again.");
    const leavingAt = Date.now();
    await ctx.db.patch("users", req.panelId, { status: "leaving", leavingAt, updatedAt: leavingAt });
    await ctx.scheduler.runAfter(0, internal.leaving.leave, { userId: req.panelId, leavingAt });
    return null;
  },
});
