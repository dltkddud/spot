import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { EVENT_ENDS_AT, makeEvent, makeRequests, makeUsers, ZONES } from "../src/lib/mockData";
import { scheduleEventEnd } from "./events";
import { scheduleLeaving } from "./leaving";

// Makes the event's zones match mockData ZONES, matched by code so that
// renaming a zone never breaks where people already said they are.
// Returns mockData zone id -> Convex zone id.
async function syncZones(ctx: MutationCtx, eventId: Id<"events">) {
  const rows = await ctx.db
    .query("zones")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(100);
  const zoneIds: Record<string, Id<"zones">> = {};
  for (const [order, z] of ZONES.entries()) {
    const row = rows.find((r) => r.code === z.code);
    if (!row) {
      zoneIds[z.id] = await ctx.db.insert("zones", { eventId, code: z.code, name: z.name, landmark: z.landmark, order });
      continue;
    }
    if (row.name !== z.name || row.landmark !== z.landmark || row.order !== order) {
      await ctx.db.patch("zones", row._id, { name: z.name, landmark: z.landmark, order });
    }
    zoneIds[z.id] = row._id;
  }
  return zoneIds;
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

// Puts every demo person where mockData starts them, adding any that are
// missing. Returns seed key -> Convex user id.
async function placeDemoPeople(
  ctx: MutationCtx,
  eventId: Id<"events">,
  zoneIds: Record<string, Id<"zones">>,
  now: number,
) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(1000);
  const bySeedKey = new Map(existing.filter((u) => u.seedKey).map((u) => [u.seedKey!, u._id]));

  const userIds: Record<string, Id<"users">> = {};
  for (const { id, zoneId, ...u } of makeUsers(now)) {
    const doc = { ...u, eventId, zoneId: zoneId ? zoneIds[zoneId] : undefined, seedKey: id };
    const rowId = bySeedKey.get(id);
    if (rowId) await ctx.db.replace("users", rowId, doc);
    userIds[id] = rowId ?? (await ctx.db.insert("users", doc));
    if (u.leavingAt) await scheduleLeaving(ctx, userIds[id], u.leavingAt);
  }
  return userIds;
}

// Called when the app starts. Fills the single event, its zones, and the
// demo people/requests from mockData if the tables are empty. On an existing
// event it only keeps the end time and zone names in line with mockData.
export const ensure = mutation({
  args: {},
  returns: v.id("events"),
  handler: async (ctx) => {
    const existing = await ctx.db.query("events").first();
    if (existing) {
      // Older deployments were seeded with "3 hours from now". Pin them to the real end.
      if (existing.endsAt !== EVENT_ENDS_AT) await ctx.db.patch("events", existing._id, { endsAt: EVENT_ENDS_AT });
      await syncZones(ctx, existing._id);
      await scheduleEventEnd(ctx, existing._id);
      return existing._id;
    }

    const now = Date.now();
    const { name, venue, endsAt } = makeEvent();
    const eventId = await ctx.db.insert("events", { name, venue, endsAt });
    const zoneIds = await syncZones(ctx, eventId);
    const userIds = await placeDemoPeople(ctx, eventId, zoneIds, now);
    await insertDemoRequests(ctx, eventId, userIds, now);
    await scheduleEventEnd(ctx, eventId);
    return eventId;
  },
});

// "Reset demo": puts the demo people and their requests back where mockData
// starts them (adding demo people added to mockData later). Real sign-ups,
// and requests between real sign-ups, are left alone.
export const resetDemo = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const now = Date.now();
    const zoneIds = await syncZones(ctx, eventId);
    const userIds = await placeDemoPeople(ctx, eventId, zoneIds, now);
    const demoIds = new Set<Id<"users">>(Object.values(userIds));

    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_event_and_status", (q) => q.eq("eventId", eventId))
      .take(2000);
    for (const r of requests) {
      if (demoIds.has(r.panelId) || demoIds.has(r.attendeeId)) await ctx.db.delete("chatRequests", r._id);
    }
    await insertDemoRequests(ctx, eventId, userIds, now);
    return null;
  },
});
