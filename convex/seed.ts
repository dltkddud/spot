import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { makeEvent, makeRequests, makeUsers, ZONES } from "../src/lib/mockData";
import { scheduleEventEnd } from "./events";
import { scheduleLeaving } from "./leaving";

async function insertZones(ctx: MutationCtx, eventId: Id<"events">) {
  const zoneIds: Record<string, Id<"zones">> = {};
  for (const [order, z] of ZONES.entries()) {
    zoneIds[z.id] = await ctx.db.insert("zones", {
      eventId,
      code: z.code,
      name: z.name,
      landmark: z.landmark,
      order,
    });
  }
  return zoneIds;
}

async function insertDemoPeople(
  ctx: MutationCtx,
  eventId: Id<"events">,
  zoneIds: Record<string, Id<"zones">>,
  now: number,
) {
  const userIds: Record<string, Id<"users">> = {};
  for (const { id, zoneId, ...u } of makeUsers(now)) {
    userIds[id] = await ctx.db.insert("users", {
      ...u,
      eventId,
      zoneId: zoneId ? zoneIds[zoneId] : undefined,
      seedKey: id,
    });
    if (u.leavingAt) await scheduleLeaving(ctx, userIds[id], u.leavingAt);
  }
  await insertDemoRequests(ctx, eventId, userIds, now);
}

async function insertDemoRequests(
  ctx: MutationCtx,
  eventId: Id<"events">,
  userIds: Record<string, Id<"users">>,
  now: number,
) {
  for (const { panelId, attendeeId, note, status, createdAt } of makeRequests(now)) {
    if (!userIds[panelId] || !userIds[attendeeId]) continue;
    await ctx.db.insert("chatRequests", {
      eventId,
      note,
      status,
      createdAt,
      panelId: userIds[panelId],
      attendeeId: userIds[attendeeId],
    });
  }
}

// Called once when the app starts. Fills the single event, its zones, and the
// demo people/requests from mockData if the tables are empty.
export const ensure = mutation({
  args: {},
  returns: v.id("events"),
  handler: async (ctx) => {
    const existing = await ctx.db.query("events").first();
    if (existing) {
      const zone = await ctx.db
        .query("zones")
        .withIndex("by_event", (q) => q.eq("eventId", existing._id))
        .first();
      if (!zone) await insertZones(ctx, existing._id);
      await scheduleEventEnd(ctx, existing._id);
      return existing._id;
    }

    const now = Date.now();
    const { name, venue, endsAt } = makeEvent(now);
    const eventId = await ctx.db.insert("events", { name, venue, endsAt });
    const zoneIds = await insertZones(ctx, eventId);
    await insertDemoPeople(ctx, eventId, zoneIds, now);
    await scheduleEventEnd(ctx, eventId);
    return eventId;
  },
});

// "Reset demo": puts the demo people and their requests back where mockData
// starts them, and moves the event end 3 hours out again. Real sign-ups, and
// requests between real sign-ups, are left alone.
export const resetDemo = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const now = Date.now();
    await ctx.db.patch("events", eventId, { endsAt: makeEvent(now).endsAt });
    await scheduleEventEnd(ctx, eventId);

    const zones = await ctx.db
      .query("zones")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(100);
    const zoneIds: Record<string, Id<"zones">> = {};
    for (const z of ZONES) {
      const match = zones.find((row) => row.code === z.code);
      if (match) zoneIds[z.id] = match._id;
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(1000);
    const bySeedKey = new Map(users.filter((u) => u.seedKey).map((u) => [u.seedKey!, u]));
    const demoIds = new Set(users.filter((u) => u.seedKey).map((u) => u._id));

    for (const { id, zoneId, ...u } of makeUsers(now)) {
      const row = bySeedKey.get(id);
      if (!row) continue;
      await ctx.db.replace("users", row._id, {
        ...u,
        eventId,
        zoneId: zoneId ? zoneIds[zoneId] : undefined,
        seedKey: id,
      });
      if (u.leavingAt) await scheduleLeaving(ctx, row._id, u.leavingAt);
    }

    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_event_and_status", (q) => q.eq("eventId", eventId))
      .take(2000);
    for (const r of requests) {
      if (demoIds.has(r.panelId) || demoIds.has(r.attendeeId)) await ctx.db.delete("chatRequests", r._id);
    }
    const userIds: Record<string, Id<"users">> = {};
    for (const [key, u] of bySeedKey) userIds[key] = u._id;
    await insertDemoRequests(ctx, eventId, userIds, now);
    return null;
  },
});
