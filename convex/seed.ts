import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { CAL_HACKS_KEY, EVENTS, type MockEvent } from "../src/lib/mockData";
import { scheduleEventEnd } from "./events";
import { scheduleLeaving } from "./leaving";
import { proposeFor } from "./huddles";
import { disconnect } from "./connections";
import { profileFromLegacy } from "./profiles";

// ---------------------------------------------------------------------------
// Migrations. Each runs once, the first time seed.ensure sees it, in
// Development and Production alike, and is recorded in the migrations table.

async function runOnce(ctx: MutationCtx, name: string, migrate: () => Promise<void>) {
  const done = await ctx.db
    .query("migrations")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (done) return;
  await migrate();
  await ctx.db.insert("migrations", { name, ranAt: Date.now() });
}

// Clears the fields left behind by "Still here?" and "Stay connected?".
async function removeStillHereAndStay(ctx: MutationCtx) {
  for await (const u of ctx.db.query("users")) {
    if (u.locationCheckAt !== undefined) await ctx.db.patch("users", u._id, { locationCheckAt: undefined });
  }
  for await (const m of ctx.db.query("huddleMembers")) {
    if (m.stayAnswered !== undefined || m.stayYes !== undefined) {
      await ctx.db.patch("huddleMembers", m._id, { stayAnswered: undefined, stayYes: undefined });
    }
  }
}

// One event became many, and people got profiles shared across events:
// - the original single event is Cal Hacks (gets its key and floor plan),
// - every participation gets a profile (name, links, code move there),
// - per-event connections become profile connections.
async function profilesAndEvents(ctx: MutationCtx) {
  for await (const e of ctx.db.query("events")) {
    if (!e.key && e.name === "Cal Hacks 13.0") await ctx.db.patch("events", e._id, { key: CAL_HACKS_KEY });
  }
  for await (const u of ctx.db.query("users")) {
    if (!u.profileId) await profileFromLegacy(ctx, u);
  }
  for await (const c of ctx.db.query("connections")) {
    const [a, b] = await Promise.all([ctx.db.get("users", c.userId), ctx.db.get("users", c.otherId)]);
    if (a?.profileId && b?.profileId && a.profileId !== b.profileId) {
      const exists = await ctx.db
        .query("profileConnections")
        .withIndex("by_profile_and_other", (q) => q.eq("profileId", a.profileId!).eq("otherId", b.profileId!))
        .unique();
      const by = c.by ? (await ctx.db.get("users", c.by))?.profileId : undefined;
      if (!exists) {
        await ctx.db.insert("profileConnections", {
          profileId: a.profileId,
          otherId: b.profileId,
          source: c.source,
          by,
          createdAt: c.createdAt,
        });
      }
    }
    await ctx.db.delete("connections", c._id);
  }
}

// ---------------------------------------------------------------------------
// Demo data from mockData.EVENTS.

// Makes an event's zones match mockData, matched by code so that renaming a
// zone never breaks where people already said they are.
// Returns mockData zone id -> Convex zone id.
async function syncZones(ctx: MutationCtx, eventId: Id<"events">, mock: MockEvent) {
  const rows = await ctx.db
    .query("zones")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(100);
  const zoneIds: Record<string, Id<"zones">> = {};
  for (const [order, z] of mock.zones.entries()) {
    const fields = { code: z.code, name: z.name, landmark: z.landmark, icon: z.icon, order };
    const row = rows.find((r) => r.code === z.code);
    if (!row) {
      zoneIds[z.id] = await ctx.db.insert("zones", { eventId, ...fields });
      continue;
    }
    if (row.name !== z.name || row.landmark !== z.landmark || row.icon !== z.icon || row.order !== order) {
      await ctx.db.patch("zones", row._id, fields);
    }
    zoneIds[z.id] = row._id;
  }
  return zoneIds;
}

// Puts every demo person where mockData starts them, giving each a profile
// (found again by seed key) and a place at this event.
// Returns seed key -> Convex user id at this event.
async function placeDemoPeople(
  ctx: MutationCtx,
  eventId: Id<"events">,
  zoneIds: Record<string, Id<"zones">>,
  mock: MockEvent,
  now: number,
) {
  const userIds: Record<string, Id<"users">> = {};
  for (const p of mock.people(now)) {
    const profileFields = {
      name: p.name,
      headline: p.headline,
      interests: p.interests,
      linkedinUrl: p.linkedinUrl,
      contactUrl: p.contactUrl,
    };
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_seed_key", (q) => q.eq("seedKey", p.id))
      .first();
    const profileId = profile?._id ?? (await ctx.db.insert("profiles", { ...profileFields, seedKey: p.id, createdAt: now }));
    if (profile) await ctx.db.patch("profiles", profile._id, profileFields);

    const doc: Omit<Doc<"users">, "_id" | "_creationTime"> = {
      eventId,
      profileId,
      role: p.role,
      talkTitle: p.talkTitle,
      outfit: p.outfit,
      zoneId: p.zoneId ? zoneIds[p.zoneId] : undefined,
      status: p.status,
      leavingAt: p.leavingAt,
      visible: p.visible,
      shareWith: p.shareWith,
      requestsPaused: p.requestsPaused,
      updatedAt: p.updatedAt,
      seedKey: p.id,
    };
    const row = await ctx.db
      .query("users")
      .withIndex("by_profile_and_event", (q) => q.eq("profileId", profileId).eq("eventId", eventId))
      .first();
    if (row) await ctx.db.replace("users", row._id, doc);
    userIds[p.id] = row?._id ?? (await ctx.db.insert("users", doc));
    if (p.leavingAt) await scheduleLeaving(ctx, userIds[p.id], p.leavingAt);
  }
  return userIds;
}

// Keeps demo people's profiles (name, one line, interests, links) in line with
// mockData without moving them around the event.
async function syncDemoProfiles(ctx: MutationCtx, mock: MockEvent, now: number) {
  for (const p of mock.people(now)) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_seed_key", (q) => q.eq("seedKey", p.id))
      .first();
    if (!profile) continue;
    const same =
      profile.name === p.name &&
      profile.headline === p.headline &&
      profile.interests.join() === p.interests.join() &&
      profile.linkedinUrl === p.linkedinUrl &&
      profile.contactUrl === p.contactUrl;
    if (!same) {
      await ctx.db.patch("profiles", profile._id, {
        name: p.name,
        headline: p.headline,
        interests: p.interests,
        linkedinUrl: p.linkedinUrl,
        contactUrl: p.contactUrl,
      });
    }
  }
}

async function insertDemoRequests(
  ctx: MutationCtx,
  eventId: Id<"events">,
  userIds: Record<string, Id<"users">>,
  mock: MockEvent,
  now: number,
) {
  for (const { panelId, attendeeId, note, status, createdAt } of mock.requests(now)) {
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
async function primeDemoHuddles(ctx: MutationCtx, userIds: Record<string, Id<"users">>, mock: MockEvent, now: number) {
  for (const p of mock.people(now)) {
    if (p.role !== "panel" || !userIds[p.id]) continue;
    const panelId = userIds[p.id];
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

// Removes huddles that involve demo people at this event, and connections
// that involve their profiles.
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

    const profileId = (await ctx.db.get("users", userId))?.profileId;
    if (!profileId) continue;
    const links = await ctx.db
      .query("profileConnections")
      .withIndex("by_profile_and_other", (q) => q.eq("profileId", profileId))
      .take(500);
    for (const link of links) await disconnect(ctx, profileId, link.otherId);
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

// Creates a mockData event with its zones, people, requests and huddles, or,
// if it already exists, keeps its details, times and zones in line with mockData.
async function ensureEvent(ctx: MutationCtx, mock: MockEvent, now: number) {
  const details = {
    key: mock.key,
    name: mock.name,
    venue: mock.venue,
    startsAt: mock.startsAt,
    endsAt: mock.endsAt,
    floorPlan: mock.floorPlan,
  };
  const existing = await ctx.db
    .query("events")
    .withIndex("by_key", (q) => q.eq("key", mock.key))
    .first();
  if (existing) {
    const changed = (Object.keys(details) as (keyof typeof details)[]).some((k) => existing[k] !== details[k]);
    if (changed) await ctx.db.patch("events", existing._id, details);
    await syncZones(ctx, existing._id, mock);
    await syncDemoProfiles(ctx, mock, now);
    await scheduleEventEnd(ctx, existing._id);
    return;
  }
  const eventId = await ctx.db.insert("events", details);
  const zoneIds = await syncZones(ctx, eventId, mock);
  const userIds = await placeDemoPeople(ctx, eventId, zoneIds, mock, now);
  await insertDemoRequests(ctx, eventId, userIds, mock, now);
  await primeDemoHuddles(ctx, userIds, mock, now);
  await scheduleEventEnd(ctx, eventId);
}

// Called when the app starts: runs pending migrations, then makes sure every
// mockData event exists. Real sign-ups are never touched.
export const ensure = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await runOnce(ctx, "remove-still-here-and-stay", () => removeStillHereAndStay(ctx));
    await runOnce(ctx, "profiles-and-events-v1", () => profilesAndEvents(ctx));
    const now = Date.now();
    for (const mock of EVENTS) await ensureEvent(ctx, mock, now);
    return null;
  },
});

// "Reset demo": puts this event's demo people, their requests and their
// huddles back where mockData starts them. Real sign-ups, and requests and
// huddles between real sign-ups, are left alone.
export const resetDemo = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get("events", eventId);
    const mock = EVENTS.find((e) => e.key === event?.key);
    if (!event || !mock) throw new ConvexError("This event has no demo data.");
    const now = Date.now();
    const zoneIds = await syncZones(ctx, eventId, mock);
    const userIds = await placeDemoPeople(ctx, eventId, zoneIds, mock, now);
    const demoIds = new Set<Id<"users">>(Object.values(userIds));
    await clearDemoSocial(ctx, demoIds);

    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_event_and_status", (q) => q.eq("eventId", eventId))
      .take(2000);
    for (const r of requests) {
      if (demoIds.has(r.panelId) || demoIds.has(r.attendeeId)) await ctx.db.delete("chatRequests", r._id);
    }
    await insertDemoRequests(ctx, eventId, userIds, mock, now);
    await primeDemoHuddles(ctx, userIds, mock, now);
    return null;
  },
});
