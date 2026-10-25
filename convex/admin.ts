import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deleteHuddle, deleteParticipations } from "./cleanup";

// Run from a terminal only (internal, so screens can't call these). Event keys
// are in src/lib/mockData.ts, e.g. "calhacks-13".
//   npx convex run admin:listParticipants '{"eventKey":"calhacks-13"}' --prod
//   npx convex run admin:removeParticipants '{"userIds":["..."]}' --prod
//   npx convex run admin:resetActivity '{"eventKey":"calhacks-13"}' --prod

async function eventByKey(ctx: QueryCtx, eventKey: string) {
  const event = await ctx.db
    .query("events")
    .withIndex("by_key", (q) => q.eq("key", eventKey))
    .first();
  if (!event) throw new ConvexError(`No event with key "${eventKey}".`);
  return event;
}

// Everyone at an event, oldest first.
export const listParticipants = internalQuery({
  args: { eventKey: v.string() },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      role: v.string(),
      hasLinkedin: v.boolean(),
      createdAt: v.string(),
    }),
  ),
  handler: async (ctx, { eventKey }) => {
    const event = await eventByKey(ctx, eventKey);
    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .take(1000);
    const out = [];
    for (const u of users) {
      const profile = u.profileId ? await ctx.db.get("profiles", u.profileId) : null;
      out.push({
        userId: u._id,
        name: profile?.name ?? "(no profile)",
        role: u.role === "panel" ? "speaker" : "guest",
        hasLinkedin: !!profile?.linkedinUrl,
        createdAt: new Date(u._creationTime).toISOString(),
      });
    }
    return out;
  },
});

// Test sign-ups: their participations and everything attached (requests,
// huddles, 10-minute chats, matches, activity). Profiles stay.
export const removeParticipants = internalMutation({
  args: { userIds: v.array(v.id("users")) },
  returns: v.object({ removed: v.number() }),
  handler: async (ctx, { userIds }) => {
    const ids = new Set<Id<"users">>();
    for (const id of userIds) if (await ctx.db.get("users", id)) ids.add(id);
    await deleteParticipations(ctx, ids);
    return { removed: ids.size };
  },
});

// Before a demo: keeps profiles, participations, zones and connections, and
// clears requests, huddles, 10-minute chats, saved matches, leaving times,
// follow-up messages and activity. Everyone is free to talk again, and
// speakers who left are back where they were.
export const resetActivity = internalMutation({
  args: { eventKey: v.string() },
  returns: v.object({ people: v.number(), requests: v.number(), huddles: v.number(), matches: v.number() }),
  handler: async (ctx, { eventKey }) => {
    const event = await eventByKey(ctx, eventKey);
    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .take(1000);

    let huddles = 0;
    let matches = 0;
    for (const u of users) {
      const own = await ctx.db
        .query("huddles")
        .withIndex("by_panel_and_status", (q) => q.eq("panelId", u._id))
        .take(1000);
      for (const h of own) {
        await deleteHuddle(ctx, h._id);
        huddles++;
      }
      for (const index of ["by_from_and_status", "by_to_and_status"] as const) {
        const field = index === "by_from_and_status" ? "fromId" : "toId";
        const rows = await ctx.db
          .query("matches")
          .withIndex(index, (q) => q.eq(field, u._id))
          .take(1000);
        for (const m of rows) {
          if (await ctx.db.get("matches", m._id)) {
            await ctx.db.delete("matches", m._id);
            matches++;
          }
        }
      }
      const sets = await ctx.db
        .query("matchSets")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .take(10);
      for (const s of sets) await ctx.db.delete("matchSets", s._id);
    }

    let requests = 0;
    for await (const r of ctx.db.query("chatRequests").withIndex("by_event_and_status", (q) => q.eq("eventId", event._id))) {
      await ctx.db.delete("chatRequests", r._id);
      requests++;
    }
    for await (const a of ctx.db.query("activity").withIndex("by_event_type", (q) => q.eq("eventId", event._id))) {
      await ctx.db.delete("activity", a._id);
    }

    // Clearing leavingAt also turns any scheduled leaving jobs into no-ops.
    const now = Date.now();
    for (const u of users) {
      const back = u.leftFrom;
      await ctx.db.patch("users", u._id, {
        status: "available",
        leavingAt: undefined,
        stillHereAskedAt: undefined,
        requestsPaused: false,
        leftFrom: undefined,
        ...(back && { zoneId: back.zoneId, shareWith: back.shareWith, visible: back.shareWith === "everyone" }),
        updatedAt: now,
      });
    }
    return { people: users.length, requests, huddles, matches };
  },
});
