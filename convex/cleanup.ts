import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Removing people (demo people, test sign-ups) and everything that points at
// them. Used by the remove-demo-people migration in seed.ts and by admin.ts.

// Deletes a huddle and its members. Requests of people who stay go back to
// their own place in line.
export async function deleteHuddle(ctx: MutationCtx, huddleId: Id<"huddles">) {
  const members = await ctx.db
    .query("huddleMembers")
    .withIndex("by_huddle", (q) => q.eq("huddleId", huddleId))
    .take(10);
  for (const m of members) {
    const req = await ctx.db.get("chatRequests", m.requestId);
    if (req?.huddleId === huddleId) await ctx.db.patch("chatRequests", req._id, { huddleId: undefined, lineAt: undefined });
    await ctx.db.delete("huddleMembers", m._id);
  }
  if (await ctx.db.get("huddles", huddleId)) await ctx.db.delete("huddles", huddleId);
}

// Deletes these participations and their requests, huddles, 10-minute chats,
// saved AI matches and activity, at whatever events they're at. Profiles stay.
export async function deleteParticipations(ctx: MutationCtx, userIds: Set<Id<"users">>) {
  if (userIds.size === 0) return;
  const eventIds = new Set<Id<"events">>();
  const huddleIds = new Set<Id<"huddles">>();

  for (const userId of userIds) {
    const user = await ctx.db.get("users", userId);
    if (user) eventIds.add(user.eventId);

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
  }
  for (const huddleId of huddleIds) await deleteHuddle(ctx, huddleId);

  for (const userId of userIds) {
    const asPanel = await ctx.db
      .query("chatRequests")
      .withIndex("by_panel_status", (q) => q.eq("panelId", userId))
      .take(2000);
    const asGuest = await ctx.db
      .query("chatRequests")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", userId))
      .take(2000);
    for (const r of [...asPanel, ...asGuest]) {
      if (await ctx.db.get("chatRequests", r._id)) await ctx.db.delete("chatRequests", r._id);
    }

    for (const index of ["by_from_and_status", "by_to_and_status"] as const) {
      const field = index === "by_from_and_status" ? "fromId" : "toId";
      const rows = await ctx.db
        .query("matches")
        .withIndex(index, (q) => q.eq(field, userId))
        .take(1000);
      for (const m of rows) if (await ctx.db.get("matches", m._id)) await ctx.db.delete("matches", m._id);
    }
    const sets = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(10);
    for (const s of sets) await ctx.db.delete("matchSets", s._id);
  }

  // Other people's saved AI matches that suggest someone who is gone.
  for await (const s of ctx.db.query("matchSets")) {
    const items = s.items.filter((i) => !userIds.has(i.otherId));
    if (items.length !== s.items.length) await ctx.db.patch("matchSets", s._id, { items });
  }

  for (const eventId of eventIds) {
    for await (const a of ctx.db.query("activity").withIndex("by_event_type", (q) => q.eq("eventId", eventId))) {
      if (userIds.has(a.userId) || (a.targetId && userIds.has(a.targetId))) await ctx.db.delete("activity", a._id);
    }
  }

  for (const userId of userIds) if (await ctx.db.get("users", userId)) await ctx.db.delete("users", userId);
}

// Deletes profiles (and their connections both ways). Their participations
// should already be gone.
export async function deleteProfiles(ctx: MutationCtx, profileIds: Set<Id<"profiles">>) {
  for (const profileId of profileIds) {
    const links = await ctx.db
      .query("profileConnections")
      .withIndex("by_profile_and_other", (q) => q.eq("profileId", profileId))
      .take(1000);
    for (const link of links) {
      await ctx.db.delete("profileConnections", link._id);
      const back = await ctx.db
        .query("profileConnections")
        .withIndex("by_profile_and_other", (q) => q.eq("profileId", link.otherId).eq("otherId", profileId))
        .unique();
      if (back) await ctx.db.delete("profileConnections", back._id);
    }
    if (await ctx.db.get("profiles", profileId)) await ctx.db.delete("profiles", profileId);
  }
}
