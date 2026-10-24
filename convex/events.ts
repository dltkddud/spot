import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import schema from "./schema";

// The app assumes a single event.
export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      event: schema.doc("events"),
      zones: v.array(schema.doc("zones")),
    }),
  ),
  handler: async (ctx) => {
    const event = await ctx.db.query("events").first();
    if (!event) return null;
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .take(100);
    zones.sort((a, b) => a.order - b.order);
    return { event, zones };
  },
});

const crowdLevel = v.union(v.literal("quiet"), v.literal("some"), v.literal("busy"));

// How busy each zone is, counting everyone who set a zone, hidden people
// included. Only a level is returned, never a count, and fewer than 3 people
// is always "quiet" so one hidden person can't be spotted.
export const zoneActivity = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.object({ zoneId: v.id("zones"), level: crowdLevel })),
  handler: async (ctx, { eventId }) => {
    const counts = new Map<Id<"zones">, number>();
    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(2000);
    for (const u of users) {
      if (u.zoneId) counts.set(u.zoneId, (counts.get(u.zoneId) ?? 0) + 1);
    }
    return [...counts].map(([zoneId, n]) => ({
      zoneId,
      level: n >= 6 ? ("busy" as const) : n >= 3 ? ("some" as const) : ("quiet" as const),
    }));
  },
});

// Schedules the end-of-event cleanup for the event's current endsAt, once.
export async function scheduleEventEnd(ctx: MutationCtx, eventId: Id<"events">) {
  const event = await ctx.db.get("events", eventId);
  if (!event || event.cleanupScheduledFor === event.endsAt) return;
  await ctx.scheduler.runAt(event.endsAt, internal.events.endEvent, { eventId, endsAt: event.endsAt });
  await ctx.db.patch("events", eventId, { cleanupScheduledFor: event.endsAt });
}

// When the event ends, everyone's zone, status and leaving time are cleared.
// Profiles stay. status is required, so it goes back to the default.
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
        locationCheckAt: undefined,
        status: "available",
        leavingAt: undefined,
        updatedAt: now,
      });
    }
    return null;
  },
});
