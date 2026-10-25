import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { OUTFIT_WORD_LIMIT } from "../src/lib/mockData";
import { closeLine, scheduleLeaving } from "./leaving";
import type { Doc, Id } from "./_generated/dataModel";

// users holds one person's part in one event (role, outfit, zone, status).
// Who they are lives in their profile; listByEvent joins the two.

const shareWithValidator = v.union(v.literal("everyone"), v.literal("connections"), v.literal("nobody"));

export function shareWithOf(u: Doc<"users">) {
  return u.shareWith ?? (u.visible ? "everyone" : "nobody");
}

export function cleanOutfit(outfit: string) {
  const trimmed = outfit.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  if (words === 0 || words > OUTFIT_WORD_LIMIT) {
    throw new ConvexError(`Describe your outfit in 1 to ${OUTFIT_WORD_LIMIT} words.`);
  }
  return trimmed;
}

// My part in this event: zone, outfit, who sees me, request pause, role and
// talk title. Only the fields passed are changed.
export const update = mutation({
  args: {
    id: v.id("users"),
    zoneId: v.optional(v.id("zones")),
    outfit: v.optional(v.string()),
    visible: v.optional(v.boolean()),
    shareWith: v.optional(shareWithValidator),
    requestsPaused: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("panel"), v.literal("attendee"))),
    // Empty clears it.
    talkTitle: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, zoneId, outfit, visible, shareWith, requestsPaused, role, talkTitle }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    if (zoneId) {
      const zone = await ctx.db.get("zones", zoneId);
      if (!zone || zone.eventId !== user.eventId) throw new ConvexError("Zone not found.");
    }
    // A speaker becoming a guest: their line closes as if they'd left.
    const stopsSpeaking = role === "attendee" && user.role === "panel";
    if (stopsSpeaking) await closeLine(ctx, id);

    await ctx.db.patch("users", id, {
      ...(zoneId !== undefined && { zoneId }),
      ...(outfit !== undefined && { outfit: cleanOutfit(outfit) }),
      // visible and shareWith always move together.
      ...(shareWith !== undefined && { shareWith, visible: shareWith === "everyone" }),
      ...(shareWith === undefined && visible !== undefined && { visible, shareWith: visible ? "everyone" : "nobody" }),
      ...(requestsPaused !== undefined && { requestsPaused }),
      ...(role !== undefined && { role }),
      ...(talkTitle !== undefined && { talkTitle: talkTitle.trim() || undefined }),
      ...(stopsSpeaking && { status: "available" as const, leavingAt: undefined, requestsPaused: false }),
      // Any update answers a pending "Still here?".
      stillHereAskedAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// "Still here?": someone looking at a zone that hasn't been updated in a while
// asks its owner to confirm. The owner sees a prompt until they answer.
export const askStillHere = mutation({
  args: { id: v.id("users"), askerId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { id, askerId }) => {
    if (id === askerId) throw new ConvexError("You can't ask yourself.");
    const [user, asker] = await Promise.all([ctx.db.get("users", id), ctx.db.get("users", askerId)]);
    if (!user || !asker || user.eventId !== asker.eventId) throw new ConvexError("User not found.");
    if (!user.zoneId) throw new ConvexError("They aren't sharing a zone right now.");
    // Already asked and not answered yet: one prompt is enough.
    if (user.stillHereAskedAt !== undefined) return null;
    await ctx.db.patch("users", id, { stillHereAskedAt: Date.now() });
    return null;
  },
});

// The owner taps "Still here": same zone, fresh time.
export const confirmStillHere = mutation({
  args: { id: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    await ctx.db.patch("users", id, { stillHereAskedAt: undefined, updatedAt: Date.now() });
    return null;
  },
});

// "available" / "talking" clear any leaving time, which also turns the old
// leaving jobs into no-ops. "leaving" needs the time I'm leaving, worked out
// on my phone when I tap, so the countdown shows exactly what I picked.
export const setStatus = mutation({
  args: {
    id: v.id("users"),
    status: v.union(v.literal("available"), v.literal("talking"), v.literal("leaving")),
    leavingAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, status, leavingAt }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    const now = Date.now();
    if (status === "leaving") {
      if (leavingAt === undefined) throw new ConvexError("Pick when you're leaving.");
      if (leavingAt <= now) throw new ConvexError("Pick a time later than now.");
      const event = await ctx.db.get("events", user.eventId);
      if (event && leavingAt > event.endsAt) throw new ConvexError("Pick a time before the event ends.");
      await ctx.db.patch("users", id, { status, leavingAt, stillHereAskedAt: undefined, updatedAt: now });
      await scheduleLeaving(ctx, id, leavingAt);
    } else {
      await ctx.db.patch("users", id, { status, leavingAt: undefined, stillHereAskedAt: undefined, updatedAt: now });
    }
    return null;
  },
});

const personValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  eventId: v.id("events"),
  profileId: v.id("profiles"),
  role: v.union(v.literal("panel"), v.literal("attendee")),
  talkTitle: v.optional(v.string()),
  outfit: v.string(),
  zoneId: v.optional(v.id("zones")),
  status: v.union(v.literal("available"), v.literal("talking"), v.literal("leaving")),
  leavingAt: v.optional(v.number()),
  visible: v.boolean(),
  shareWith: v.optional(shareWithValidator),
  requestsPaused: v.boolean(),
  updatedAt: v.number(),
  stillHereAskedAt: v.optional(v.number()),
  seedKey: v.optional(v.string()),
  learnToday: v.optional(v.string()),
  canShare: v.optional(v.string()),
  // From the profile.
  name: v.string(),
  headline: v.string(),
  interests: v.array(v.string()),
  linkedinUrl: v.optional(v.string()),
  contactUrl: v.optional(v.string()),
  openToHuddles: v.optional(v.boolean()),
});

// Everyone at the event, as the viewer is allowed to see them, with their
// profile filled in. visible is worked out per viewer: true if they share with
// everyone, or with their connections and the viewer's profile is one. Anyone
// not visible keeps their profile but not their zone.
export const listByEvent = query({
  args: { eventId: v.id("events"), viewerId: v.optional(v.string()) },
  returns: v.array(personValidator),
  handler: async (ctx, { eventId, viewerId }) => {
    const viewerUserId = viewerId ? ctx.db.normalizeId("users", viewerId) : null;
    const viewer = viewerUserId ? await ctx.db.get("users", viewerUserId) : null;
    const connected = new Set<Id<"profiles">>();
    if (viewer?.profileId) {
      const links = await ctx.db
        .query("profileConnections")
        .withIndex("by_profile_and_other", (q) => q.eq("profileId", viewer.profileId!))
        .take(500);
      links.forEach((l) => connected.add(l.otherId));
    }
    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(1000);

    const out = [];
    for (const u of users) {
      if (!u.profileId) continue; // not migrated yet
      const profile = await ctx.db.get("profiles", u.profileId);
      if (!profile) continue;
      const share = shareWithOf(u);
      const seen = u._id === viewer?._id || share === "everyone" || (share === "connections" && connected.has(u.profileId));
      out.push({
        _id: u._id,
        _creationTime: u._creationTime,
        eventId: u.eventId,
        profileId: u.profileId,
        role: u.role,
        talkTitle: u.talkTitle,
        outfit: u.outfit,
        zoneId: seen ? u.zoneId : undefined,
        status: u.status,
        leavingAt: u.leavingAt,
        // My own row keeps my real setting; everyone else's says whether I can see them.
        visible: u._id === viewer?._id ? u.visible : seen,
        shareWith: u.shareWith,
        requestsPaused: u.requestsPaused,
        updatedAt: u.updatedAt,
        stillHereAskedAt: u.stillHereAskedAt,
        seedKey: u.seedKey,
        learnToday: u.learnToday,
        canShare: u.canShare,
        name: profile.name,
        headline: profile.headline,
        interests: profile.interests,
        linkedinUrl: profile.linkedinUrl,
        contactUrl: profile.contactUrl,
        openToHuddles: profile.openToHuddles,
      });
    }
    return out;
  },
});
