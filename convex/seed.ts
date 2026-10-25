import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { CAL_HACKS_KEY, EVENTS, type MockEvent } from "../src/lib/mockData";
import { scheduleEventEnd } from "./events";
import { deleteParticipations, deleteProfiles } from "./cleanup";
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

// The demo people (Dana, Lena, ...) are gone: demos use real accounts now.
// Removes every participation and profile seed made (they have a seedKey), and
// the requests, huddles, 10-minute chats, saved matches, connections and
// activity they were part of. Real sign-ups never have a seedKey.
async function removeDemoPeople(ctx: MutationCtx) {
  const userIds = new Set<Id<"users">>();
  const profileIds = new Set<Id<"profiles">>();
  for await (const p of ctx.db.query("profiles")) if (p.seedKey) profileIds.add(p._id);
  for await (const u of ctx.db.query("users")) {
    if (u.seedKey || (u.profileId && profileIds.has(u.profileId))) userIds.add(u._id);
  }
  await deleteParticipations(ctx, userIds);
  await deleteProfiles(ctx, profileIds);
}

// ---------------------------------------------------------------------------
// Events and zones from mockData.EVENTS.

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

// Creates a mockData event with its zones or, if it already exists, keeps its
// details, times and zones in line with mockData. No people: only real sign-ups.
async function ensureEvent(ctx: MutationCtx, mock: MockEvent) {
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
  }
  const eventId = existing?._id ?? (await ctx.db.insert("events", details));
  await syncZones(ctx, eventId, mock);
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
    await runOnce(ctx, "remove-demo-people-v1", () => removeDemoPeople(ctx));
    for (const mock of EVENTS) await ensureEvent(ctx, mock);
    return null;
  },
});
