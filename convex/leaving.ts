import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { closeWithoutChat } from "./followUps";
import { LEAVE_WARNING_MIN } from "../src/lib/time";
import { dissolveAllFor } from "./huddles";
import { cancelMatchesFor } from "./matches";
import { shareWithOf } from "./users";

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
  for (const r of await activeRequests(ctx, panelId)) await closeWithoutChat(ctx, r._id, "missed", "speaker_left");
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

// The speaker is gone: huddles break up, open requests become missed (with
// LinkedIn and a follow-up for each guest), open 10-min chats are cancelled,
// and the speaker is hidden with their zone cleared (kept in leftFrom).
async function goAway(ctx: MutationCtx, user: Doc<"users">) {
  await closeLine(ctx, user._id);
  await cancelMatchesFor(ctx, user._id);
  await ctx.db.patch("users", user._id, {
    leftFrom: { zoneId: user.zoneId, shareWith: shareWithOf(user) },
    visible: false,
    shareWith: "nobody",
    zoneId: undefined,
    stillHereAskedAt: undefined,
    updatedAt: Date.now(),
  });
}

// At leavingAt, unless the speaker changed or cancelled their time since.
export const leave = internalMutation({
  args: { userId: v.id("users"), leavingAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, leavingAt }) => {
    const user = await stillLeavingAt(ctx, userId, leavingAt);
    if (user) await goAway(ctx, user);
    return null;
  },
});

// "Leaving now" on the speaker's Now screen: everything above, right away.
export const leaveNow = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError("User not found.");
    const leavingAt = Date.now();
    await ctx.db.patch("users", userId, { status: "leaving", leavingAt, updatedAt: leavingAt });
    await goAway(ctx, { ...user, status: "leaving", leavingAt });
    return null;
  },
});

// "I'm back": a speaker who left shows up where they were, free to talk.
export const comeBack = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError("User not found.");
    const back = user.leftFrom ?? { zoneId: user.zoneId, shareWith: "everyone" as const };
    await ctx.db.patch("users", userId, {
      status: "available",
      leavingAt: undefined,
      leftFrom: undefined,
      zoneId: back.zoneId,
      shareWith: back.shareWith,
      visible: back.shareWith === "everyone",
      updatedAt: Date.now(),
    });
    return null;
  },
});
