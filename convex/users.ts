import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { OUTFIT_WORD_LIMIT } from "../src/lib/mockData";
import { STALE_AFTER_MIN } from "../src/lib/time";
import { scheduleLeaving } from "./leaving";
import schema from "./schema";

const MIN = 60_000;

function cleanOutfit(outfit: string) {
  const trimmed = outfit.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  if (words === 0 || words > OUTFIT_WORD_LIMIT) {
    throw new ConvexError(`Describe your outfit in 1 to ${OUTFIT_WORD_LIMIT} words.`);
  }
  return trimmed;
}

export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    role: v.union(v.literal("panel"), v.literal("attendee")),
    headline: v.string(),
    talkTitle: v.optional(v.string()),
    interests: v.array(v.string()),
    outfit: v.string(),
    contactUrl: v.optional(v.string()),
    visible: v.boolean(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Name is required.");
    return await ctx.db.insert("users", {
      ...args,
      name,
      headline: args.headline.trim(),
      talkTitle: args.talkTitle?.trim() || undefined,
      contactUrl: args.contactUrl?.trim() || undefined,
      outfit: cleanOutfit(args.outfit),
      status: "available",
      requestsPaused: false,
      updatedAt: Date.now(),
    });
  },
});

// Zone, outfit, visibility and request pause. Only the fields passed are changed.
export const update = mutation({
  args: {
    id: v.id("users"),
    zoneId: v.optional(v.id("zones")),
    outfit: v.optional(v.string()),
    visible: v.optional(v.boolean()),
    requestsPaused: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, zoneId, outfit, visible, requestsPaused }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    if (zoneId) {
      const zone = await ctx.db.get("zones", zoneId);
      if (!zone || zone.eventId !== user.eventId) throw new ConvexError("Zone not found.");
    }
    await ctx.db.patch("users", id, {
      ...(zoneId !== undefined && { zoneId, locationCheckAt: undefined }),
      ...(outfit !== undefined && { outfit: cleanOutfit(outfit) }),
      ...(visible !== undefined && { visible }),
      ...(requestsPaused !== undefined && { requestsPaused }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

// "available" / "talking" clear any leaving time, which also turns the old
// leaving jobs into no-ops. "leaving" needs minutes from now.
export const setStatus = mutation({
  args: {
    id: v.id("users"),
    status: v.union(v.literal("available"), v.literal("talking"), v.literal("leaving")),
    leavingInMin: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { id, status, leavingInMin }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    const now = Date.now();
    if (status === "leaving") {
      if (leavingInMin === undefined || !(leavingInMin > 0)) {
        throw new ConvexError("Pick when you're leaving.");
      }
      const leavingAt = now + leavingInMin * MIN;
      await ctx.db.patch("users", id, { status, leavingAt, updatedAt: now });
      await scheduleLeaving(ctx, id, leavingAt);
    } else {
      await ctx.db.patch("users", id, { status, leavingAt: undefined, updatedAt: now });
    }
    return null;
  },
});

const ASK_AGAIN_AFTER_MIN = 5;

// "Still here?": anyone can ask someone whose zone hasn't been updated for
// 15 minutes to confirm it. Being in a zone that long is implied, since
// changing zones updates updatedAt.
export const askStillHere = mutation({
  args: { targetId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { targetId }) => {
    const target = await ctx.db.get("users", targetId);
    if (!target || !target.visible || !target.zoneId) throw new ConvexError("They're not sharing a zone right now.");
    const now = Date.now();
    if (now - target.updatedAt < STALE_AFTER_MIN * MIN) throw new ConvexError("Their location was updated recently.");
    if (target.locationCheckAt && now - target.locationCheckAt < ASK_AGAIN_AFTER_MIN * MIN) return null;
    await ctx.db.patch("users", targetId, { locationCheckAt: now });
    return null;
  },
});

// Answer to "Still here?" with "Yes". "I moved" goes through update with a new zone.
export const confirmZone = mutation({
  args: { id: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    await ctx.db.patch("users", id, { locationCheckAt: undefined, updatedAt: Date.now() });
    return null;
  },
});

// Everyone at the event. Hidden people keep their profile but not their zone,
// except for the viewer themself.
export const listByEvent = query({
  args: { eventId: v.id("events"), viewerId: v.optional(v.string()) },
  returns: v.array(schema.doc("users")),
  handler: async (ctx, { eventId, viewerId }) => {
    const viewer = viewerId ? ctx.db.normalizeId("users", viewerId) : null;
    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(1000);
    return users.map((u) => (u.visible || u._id === viewer ? u : { ...u, zoneId: undefined }));
  },
});
