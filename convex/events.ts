import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import schema from "./schema";
import { cleanOutfit } from "./users";

const eventView = v.object({
  _id: v.id("events"),
  name: v.string(),
  venue: v.string(),
  startsAt: v.optional(v.number()),
  endsAt: v.number(),
  floorPlan: v.optional(v.string()),
});

// Every event, soonest first. Each has its own zones, people and end time.
export const list = query({
  args: {},
  returns: v.array(eventView),
  handler: async (ctx) => {
    const events = await ctx.db.query("events").take(50);
    return events
      .map(({ _id, name, venue, startsAt, endsAt, floorPlan }) => ({ _id, name, venue, startsAt, endsAt, floorPlan }))
      .sort((a, b) => (a.startsAt ?? a.endsAt) - (b.startsAt ?? b.endsAt));
  },
});

// One event and its zones.
export const get = query({
  args: { eventId: v.string() },
  returns: v.union(v.null(), v.object({ event: eventView, zones: v.array(schema.doc("zones")) })),
  handler: async (ctx, { eventId }) => {
    const id = ctx.db.normalizeId("events", eventId);
    const event = id ? await ctx.db.get("events", id) : null;
    if (!event) return null;
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .take(100);
    zones.sort((a, b) => a.order - b.order);
    const { _id, name, venue, startsAt, endsAt, floorPlan } = event;
    return { event: { _id, name, venue, startsAt, endsAt, floorPlan }, zones };
  },
});

// Joining an event: how I'm here (speaker or guest), what I'm showing, what
// I'm wearing today. Joining twice returns the same participation.
export const join = mutation({
  args: {
    eventId: v.id("events"),
    profileId: v.id("profiles"),
    role: v.union(v.literal("panel"), v.literal("attendee")),
    talkTitle: v.optional(v.string()),
    outfit: v.string(),
    visible: v.boolean(),
  },
  returns: v.id("users"),
  handler: async (ctx, { eventId, profileId, role, talkTitle, outfit, visible }) => {
    if (!(await ctx.db.get("events", eventId))) throw new ConvexError("That event doesn't exist.");
    if (!(await ctx.db.get("profiles", profileId))) throw new ConvexError("Profile not found.");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_profile_and_event", (q) => q.eq("profileId", profileId).eq("eventId", eventId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      eventId,
      profileId,
      role,
      talkTitle: role === "panel" ? talkTitle?.trim() || undefined : undefined,
      outfit: cleanOutfit(outfit),
      status: "available",
      visible,
      shareWith: visible ? "everyone" : "nobody",
      requestsPaused: false,
      updatedAt: Date.now(),
    });
  },
});

// Schedules the end-of-event cleanup for the event's current endsAt, once.
export async function scheduleEventEnd(ctx: MutationCtx, eventId: Id<"events">) {
  const event = await ctx.db.get("events", eventId);
  if (!event || event.cleanupScheduledFor === event.endsAt) return;
  await ctx.scheduler.runAt(event.endsAt, internal.events.endEvent, { eventId, endsAt: event.endsAt });
  await ctx.db.patch("events", eventId, { cleanupScheduledFor: event.endsAt });
}

// When an event ends, everyone's zone, status and leaving time there are
// cleared. Profiles stay. status is required, so it goes back to the default.
export const endEvent = internalMutation({
  args: { eventId: v.id("events"), endsAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { eventId, endsAt }) => {
    const event = await ctx.db.get("events", eventId);
    if (!event || event.endsAt !== endsAt) return null;
    const now = Date.now();
    for await (const u of ctx.db.query("users").withIndex("by_event", (q) => q.eq("eventId", eventId))) {
      await ctx.db.patch("users", u._id, {
        zoneId: undefined,
        status: "available",
        leavingAt: undefined,
        updatedAt: now,
      });
    }
    return null;
  },
});
