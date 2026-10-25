import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { CAL_HACKS_KEY, EVENTS, MATCH_INPUTS, type MockEvent, type MockPerson } from "../src/lib/mockData";
import { scheduleEventEnd } from "./events";
import { scheduleLeaving } from "./leaving";
import { proposeFor } from "./huddles";
import { newConnectCode } from "./connections";
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

// Starts over with real people only: every profile, participation, request,
// huddle, AI match, connection and activity row goes. Events and zones stay. The demo
// guests in mockData (Jimin, Logan) are put back right after by ensureEvent.
async function wipePeople(ctx: MutationCtx) {
  const tables = [
    "matches",
    "matchSets",
    "huddleMembers",
    "huddles",
    "chatRequests",
    "profileConnections",
    "connections",
    "activity",
    "users",
    "profiles",
  ] as const;
  for (const table of tables) {
    for (const row of await ctx.db.query(table).take(4000)) await ctx.db.delete(table, row._id);
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
  people: MockPerson[],
  now: number,
) {
  const userIds: Record<string, Id<"users">> = {};
  for (const p of people) {
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
    const profileId =
      profile?._id ??
      (await ctx.db.insert("profiles", {
        ...profileFields,
        connectCode: await newConnectCode(ctx),
        seedKey: p.id,
        createdAt: now,
      }));
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
      learnToday: MATCH_INPUTS[p.id]?.learnToday,
      canShare: MATCH_INPUTS[p.id]?.canShare,
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

// Keeps demo people's profiles (name, one line, interests, links) and what
// they want to learn and can share in line with mockData, without moving them
// around the event. Returns the ones not there yet.
async function syncDemoProfiles(ctx: MutationCtx, eventId: Id<"events">, mock: MockEvent, now: number) {
  const missing: MockPerson[] = [];
  for (const p of mock.people(now)) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_seed_key", (q) => q.eq("seedKey", p.id))
      .first();
    if (!profile) {
      missing.push(p);
      continue;
    }
    const here = await ctx.db
      .query("users")
      .withIndex("by_profile_and_event", (q) => q.eq("profileId", profile._id).eq("eventId", eventId))
      .first();
    const { learnToday, canShare } = MATCH_INPUTS[p.id] ?? {};
    if (here && (here.learnToday !== learnToday || here.canShare !== canShare)) {
      await ctx.db.patch("users", here._id, { learnToday, canShare });
    }
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
  return missing;
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
    const zoneIds = await syncZones(ctx, existing._id, mock);
    const missing = await syncDemoProfiles(ctx, existing._id, mock, now);
    if (missing.length > 0) await placeDemoPeople(ctx, existing._id, zoneIds, missing, now);
    await scheduleEventEnd(ctx, existing._id);
    return;
  }
  const eventId = await ctx.db.insert("events", details);
  const zoneIds = await syncZones(ctx, eventId, mock);
  const userIds = await placeDemoPeople(ctx, eventId, zoneIds, mock.people(now), now);
  await insertDemoRequests(ctx, eventId, userIds, mock, now);
  await primeDemoHuddles(ctx, userIds, mock, now);
  await scheduleEventEnd(ctx, eventId);
}

// Called when the app starts: runs pending migrations, then makes sure every
// mockData event exists. Real sign-ups are never touched (except once, by wipe-people-v1).
export const ensure = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await runOnce(ctx, "remove-still-here-and-stay", () => removeStillHereAndStay(ctx));
    await runOnce(ctx, "profiles-and-events-v1", () => profilesAndEvents(ctx));
    await runOnce(ctx, "wipe-people-v1", () => wipePeople(ctx));
    const now = Date.now();
    for (const mock of EVENTS) await ensureEvent(ctx, mock, now);
    return null;
  },
});
