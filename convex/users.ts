import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { OUTFIT_WORD_LIMIT } from "../src/lib/mockData";
import { scheduleLeaving } from "./leaving";
import { proposeFor } from "./huddles";
import { newConnectCode } from "./connections";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const MIN = 60_000;

const shareWithValidator = v.union(v.literal("everyone"), v.literal("connections"), v.literal("nobody"));

export function shareWithOf(u: Doc<"users">) {
  return u.shareWith ?? (u.visible ? "everyone" : "nobody");
}

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
      shareWith: args.visible ? "everyone" : "nobody",
      connectCode: await newConnectCode(ctx),
      updatedAt: Date.now(),
    });
  },
});

// Zone, outfit, visibility, request pause and huddles. Only the fields passed are changed.
export const update = mutation({
  args: {
    id: v.id("users"),
    zoneId: v.optional(v.id("zones")),
    outfit: v.optional(v.string()),
    visible: v.optional(v.boolean()),
    shareWith: v.optional(shareWithValidator),
    requestsPaused: v.optional(v.boolean()),
    openToHuddles: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, zoneId, outfit, visible, shareWith, requestsPaused, openToHuddles }) => {
    const user = await ctx.db.get("users", id);
    if (!user) throw new ConvexError("User not found.");
    if (zoneId) {
      const zone = await ctx.db.get("zones", zoneId);
      if (!zone || zone.eventId !== user.eventId) throw new ConvexError("Zone not found.");
    }
    await ctx.db.patch("users", id, {
      ...(zoneId !== undefined && { zoneId }),
      ...(outfit !== undefined && { outfit: cleanOutfit(outfit) }),
      // visible and shareWith always move together.
      ...(shareWith !== undefined && { shareWith, visible: shareWith === "everyone" }),
      ...(shareWith === undefined && visible !== undefined && { visible, shareWith: visible ? "everyone" : "nobody" }),
      ...(requestsPaused !== undefined && { requestsPaused }),
      ...(openToHuddles !== undefined && { openToHuddles }),
      updatedAt: Date.now(),
    });
    // Turning huddles back on: look for matches in every line I'm waiting in.
    if (openToHuddles && user.openToHuddles === false) {
      const mine = await ctx.db
        .query("chatRequests")
        .withIndex("by_attendee", (q) => q.eq("attendeeId", id))
        .take(200);
      for (const r of mine) if (r.status === "waiting") await proposeFor(ctx, r.panelId);
    }
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

// Everyone at the event, as the viewer is allowed to see them. visible is
// worked out per viewer: true if they share with everyone, or with their
// connections and the viewer is one. Anyone not visible keeps their profile
// but not their zone. Only the viewer gets their own connect code.
export const listByEvent = query({
  args: { eventId: v.id("events"), viewerId: v.optional(v.string()) },
  returns: v.array(schema.doc("users")),
  handler: async (ctx, { eventId, viewerId }) => {
    const viewer = viewerId ? ctx.db.normalizeId("users", viewerId) : null;
    const connected = new Set<Id<"users">>();
    if (viewer) {
      const links = await ctx.db
        .query("connections")
        .withIndex("by_user_and_other", (q) => q.eq("userId", viewer))
        .take(500);
      links.forEach((l) => connected.add(l.otherId));
    }
    const users = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(1000);
    return users.map(({ connectCode, ...u }) => {
      if (u._id === viewer) return { ...u, connectCode };
      const share = shareWithOf({ ...u, connectCode });
      const seen = share === "everyone" || (share === "connections" && connected.has(u._id));
      return seen ? { ...u, visible: true } : { ...u, visible: false, zoneId: undefined };
    });
  },
});
