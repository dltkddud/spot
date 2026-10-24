import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { EVENT_ENDS_AT, makeEvent, makeRequests, makeUsers, ZONES } from "../src/lib/mockData";
import { scheduleEventEnd } from "./events";
import { scheduleLeaving } from "./leaving";
import { proposeFor } from "./huddles";

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

// Suggests huddles in the demo speakers' lines. In each one, everyone but the
// person who has waited longest has already said yes, so viewing as that
// person (e.g. Lena in Dana's line) shows a suggestion one tap from ready.
async function primeDemoHuddles(ctx: MutationCtx, userIds: Record<string, Id<"users">>) {
  for (const [key, panelId] of Object.entries(userIds)) {
    if (!key.startsWith("p-")) continue;
    await proposeFor(ctx, panelId);
    const proposed = await ctx.db
      .query("huddles")
      .withIndex("by_panel_and_status", (q) => q.eq("panelId", panelId).eq("status", "proposed"))
      .take(20);
    for (const h of proposed) {
      const members = await ctx.db
        .query("huddleMembers")
        .withIndex("by_huddle", (q) => q.eq("huddleId", h._id))
        .take(5);
      const requests = await Promise.all(members.map((m) => ctx.db.get("chatRequests", m.requestId)));
      const firstAt = Math.min(...requests.map((r) => r?.createdAt ?? Infinity));
      for (const [i, m] of members.entries()) {
        if (requests[i]?.createdAt !== firstAt) await ctx.db.patch("huddleMembers", m._id, { response: "yes" });
      }
    }
  }
}

// Removes huddles and connections that involve demo people.
async function clearDemoSocial(ctx: MutationCtx, demoIds: Set<Id<"users">>) {
  const huddleIds = new Set<Id<"huddles">>();
  for (const userId of demoIds) {
    const asPanel = await ctx.db
      .query("huddles")
      .withIndex("by_panel_and_status", (q) => q.eq("panelId", userId))
      .take(500);
    asPanel.forEach((h) => huddleIds.add(h._id));
    const asMember = await ctx.db
      .query("huddleMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(500);
    asMember.forEach((m) => huddleIds.add(m.huddleId));

    const links = await ctx.db
      .query("connections")
      .withIndex("by_user_and_other", (q) => q.eq("userId", userId))
      .take(500);
    for (const link of links) {
      const back = await ctx.db
        .query("connections")
        .withIndex("by_user_and_other", (q) => q.eq("userId", link.otherId).eq("otherId", userId))
        .unique();
      if (back) await ctx.db.delete("connections", back._id);
      await ctx.db.delete("connections", link._id);
    }
  }
  for (const huddleId of huddleIds) {
    const members = await ctx.db
      .query("huddleMembers")
      .withIndex("by_huddle", (q) => q.eq("huddleId", huddleId))
      .take(5);
    for (const m of members) {
      const req = await ctx.db.get("chatRequests", m.requestId);
      if (req?.huddleId === huddleId) await ctx.db.patch("chatRequests", req._id, { huddleId: undefined, lineAt: undefined });
      await ctx.db.delete("huddleMembers", m._id);
    }
    await ctx.db.delete("huddles", huddleId);
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
    await primeDemoHuddles(ctx, userIds);
    await scheduleEventEnd(ctx, eventId);
    return eventId;
  },
});

// "Reset demo": puts the demo people, their requests and their huddles back
// where mockData starts them (adding demo people added to mockData later).
// Real sign-ups, and requests/huddles between real sign-ups, are left alone.
export const resetDemo = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const now = Date.now();
    const zoneIds = await syncZones(ctx, eventId);
    const userIds = await placeDemoPeople(ctx, eventId, zoneIds, now);
    const demoIds = new Set<Id<"users">>(Object.values(userIds));
    await clearDemoSocial(ctx, demoIds);

    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_event_and_status", (q) => q.eq("eventId", eventId))
      .take(2000);
    for (const r of requests) {
      if (demoIds.has(r.panelId) || demoIds.has(r.attendeeId)) await ctx.db.delete("chatRequests", r._id);
    }
    await insertDemoRequests(ctx, eventId, userIds, now);
    await primeDemoHuddles(ctx, userIds);
    return null;
  },
});
