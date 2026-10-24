import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { record } from "./activity";

// Connections are people who agreed to see each other's zone, like sharing
// with a friend in Find My, but only ever the zone they picked.

const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

async function row(ctx: MutationCtx, userId: Id<"users">, otherId: Id<"users">) {
  return await ctx.db
    .query("connections")
    .withIndex("by_user_and_other", (q) => q.eq("userId", userId).eq("otherId", otherId))
    .unique();
}

export async function newConnectCode(ctx: MutationCtx) {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    const taken = await ctx.db
      .query("users")
      .withIndex("by_connect_code", (q) => q.eq("connectCode", code))
      .first();
    if (!taken) return code;
  }
}

// Connects two people both ways. Returns false if they were already connected.
export async function connect(
  ctx: MutationCtx,
  eventId: Id<"events">,
  a: Id<"users">,
  b: Id<"users">,
  source: Doc<"connections">["source"],
) {
  if (a === b || (await row(ctx, a, b))) return false;
  const createdAt = Date.now();
  await ctx.db.insert("connections", { eventId, userId: a, otherId: b, source, by: a, createdAt });
  if (!(await row(ctx, b, a))) {
    await ctx.db.insert("connections", { eventId, userId: b, otherId: a, source, by: a, createdAt });
  }
  await record(ctx, eventId, "connection_made", a, b);
  return true;
}

export async function disconnect(ctx: MutationCtx, a: Id<"users">, b: Id<"users">) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    const r = await row(ctx, x, y);
    if (r) await ctx.db.delete("connections", r._id);
  }
}

// Older accounts were made before codes existed.
export const ensureCode = mutation({
  args: { userId: v.id("users") },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError("User not found.");
    if (user.connectCode) return user.connectCode;
    const code = await newConnectCode(ctx);
    await ctx.db.patch("users", userId, { connectCode: code });
    return code;
  },
});

// Typing a friend's code, or opening their invite link. Handing over the code
// is their consent.
export const connectByCode = mutation({
  args: { userId: v.id("users"), code: v.string() },
  returns: v.object({ name: v.string(), isNew: v.boolean() }),
  handler: async (ctx, { userId, code }) => {
    const me = await ctx.db.get("users", userId);
    if (!me) throw new ConvexError("User not found.");
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== CODE_LENGTH) throw new ConvexError(`Codes are ${CODE_LENGTH} letters and numbers.`);
    const other = await ctx.db
      .query("users")
      .withIndex("by_connect_code", (q) => q.eq("connectCode", clean))
      .first();
    if (!other || other.eventId !== me.eventId) throw new ConvexError("No one has that code.");
    if (other._id === me._id) throw new ConvexError("That's your own code.");
    const isNew = await connect(ctx, me.eventId, me._id, other._id, "code");
    return { name: other.name, isNew };
  },
});

export const remove = mutation({
  args: { userId: v.id("users"), otherId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId, otherId }) => {
    await disconnect(ctx, userId, otherId);
    return null;
  },
});

// Demo control: connect me with two demo attendees, one of whom shares their
// zone only with connections, so connecting is what reveals it.
export const demoFriends = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const me = await ctx.db.get("users", userId);
    if (!me) throw new ConvexError("User not found.");
    const demo = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", me.eventId))
      .take(1000);
    for (const key of ["a-maya", "a-leo"]) {
      const friend = demo.find((u) => u.seedKey === key);
      if (friend && friend._id !== me._id) await connect(ctx, me.eventId, me._id, friend._id, "demo");
    }
    return null;
  },
});

// The people I'm connected with, newest first.
export const mine = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      otherId: v.id("users"),
      source: v.union(v.literal("huddle"), v.literal("code"), v.literal("demo")),
      by: v.optional(v.id("users")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_user_and_other", (q) => q.eq("userId", userId))
      .take(500);
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ otherId, source, by, createdAt }) => ({ otherId, source, by, createdAt }));
  },
});
