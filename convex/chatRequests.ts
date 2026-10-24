import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { afterRequestChange, proposeFor } from "./huddles";
import { LEAVE_WARNING_MIN } from "../src/lib/time";

const MIN = 60_000;
const NOTE_MAX = 100;
const ACTIVE = ["waiting", "accepted"] as const;

const isActive = (r: Doc<"chatRequests">) => r.status === "waiting" || r.status === "accepted";

async function activeForPanel(ctx: QueryCtx, panelId: Id<"users">) {
  const rows: Doc<"chatRequests">[] = [];
  for (const status of ACTIVE) {
    rows.push(
      ...(await ctx.db
        .query("chatRequests")
        .withIndex("by_panel_status", (q) => q.eq("panelId", panelId).eq("status", status))
        .take(500)),
    );
  }
  return rows;
}

export const create = mutation({
  args: { attendeeId: v.id("users"), panelId: v.id("users"), note: v.string() },
  returns: v.id("chatRequests"),
  handler: async (ctx, { attendeeId, panelId, note }) => {
    const attendee = await ctx.db.get("users", attendeeId);
    const panel = await ctx.db.get("users", panelId);
    if (!attendee || !panel || panel.role !== "panel" || panel.eventId !== attendee.eventId) {
      throw new ConvexError("That speaker isn't at this event.");
    }
    const panelProfile = panel.profileId ? await ctx.db.get("profiles", panel.profileId) : null;
    const first = panelProfile?.name.split(" ")[0] ?? "This speaker";
    if (attendeeId === panelId) throw new ConvexError("You can't request a chat with yourself.");
    if (!panel.visible) throw new ConvexError(`${first} has left the event floor.`);
    if (panel.requestsPaused) throw new ConvexError(`${first} paused requests.`);

    const mine = await ctx.db
      .query("chatRequests")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
      .take(500);
    if (mine.some((r) => r.panelId === panelId && isActive(r))) {
      throw new ConvexError(`You're already in line for ${first}.`);
    }

    // The heads-up job may already have run if they leave within 10 minutes.
    const now = Date.now();
    const leavingSoon =
      panel.status === "leaving" && panel.leavingAt !== undefined && panel.leavingAt - now <= LEAVE_WARNING_MIN * MIN;

    const id = await ctx.db.insert("chatRequests", {
      eventId: panel.eventId,
      panelId,
      attendeeId,
      note: note.trim().slice(0, NOTE_MAX),
      status: "waiting",
      createdAt: now,
      ...(leavingSoon && { leaveWarnedFor: panel.leavingAt }),
    });
    await proposeFor(ctx, panelId);
    return id;
  },
});

// Who may move a request where:
//   panel:    waiting -> accepted, active -> declined / missed / met
//   attendee: active -> cancelled / met
export const setStatus = mutation({
  args: {
    requestId: v.id("chatRequests"),
    actorId: v.id("users"),
    status: v.union(
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("met"),
      v.literal("cancelled"),
      v.literal("missed"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { requestId, actorId, status }) => {
    const req = await ctx.db.get("chatRequests", requestId);
    if (!req) throw new ConvexError("That request no longer exists.");
    if (req.status === status) return null;

    const byPanel = actorId === req.panelId;
    const byAttendee = actorId === req.attendeeId;
    if (!byPanel && !byAttendee) throw new ConvexError("That request isn't yours.");

    const allowed =
      status === "accepted"
        ? byPanel && req.status === "waiting"
        : isActive(req) &&
          (status === "met" || (status === "cancelled" ? byAttendee : byPanel));
    if (!allowed) throw new ConvexError("This request has already changed.");

    await ctx.db.patch("chatRequests", requestId, {
      status,
      ...(status === "accepted" && { acceptedAt: Date.now() }),
    });
    await afterRequestChange(ctx, requestId);
    return null;
  },
});

// A speaker's line: everyone waiting or accepted, with their notes.
export const forPanel = query({
  args: { panelId: v.id("users") },
  returns: v.array(schema.doc("chatRequests")),
  handler: async (ctx, { panelId }) => activeForPanel(ctx, panelId),
});

// All of an attendee's own requests, past ones included.
export const forAttendee = query({
  args: { attendeeId: v.id("users") },
  returns: v.array(schema.doc("chatRequests")),
  handler: async (ctx, { attendeeId }) =>
    await ctx.db
      .query("chatRequests")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", attendeeId))
      .order("desc")
      .take(200),
});

// Every open line at the event, without who is in it or their notes.
// Used for "N people waiting" and "You're #2 in line" (a huddle counts once).
export const activeByEvent = query({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      _id: v.id("chatRequests"),
      panelId: v.id("users"),
      status: v.union(v.literal("waiting"), v.literal("accepted")),
      createdAt: v.number(),
      huddleId: v.optional(v.id("huddles")),
      lineAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { eventId }) => {
    const rows = [];
    for (const status of ACTIVE) {
      const batch = await ctx.db
        .query("chatRequests")
        .withIndex("by_event_and_status", (q) => q.eq("eventId", eventId).eq("status", status))
        .take(1000);
      rows.push(
        ...batch.map((r) => ({
          _id: r._id,
          panelId: r.panelId,
          status,
          createdAt: r.createdAt,
          huddleId: r.huddleId,
          lineAt: r.lineAt,
        })),
      );
    }
    return rows;
  },
});
