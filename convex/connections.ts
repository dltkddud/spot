import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { record } from "./activity";

// Connections are profiles that agreed to see each other's zone, like sharing
// with a friend in Find My, but only ever the zone they picked. Made once, they
// apply at every event both people join.

const CODE_LENGTH = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

// When a connection is made at an event, it counts toward that event's activity.
type At = { eventId: Id<"events">; userId: Id<"users"> };

async function row(ctx: MutationCtx, profileId: Id<"profiles">, otherId: Id<"profiles">) {
  return await ctx.db
    .query("profileConnections")
    .withIndex("by_profile_and_other", (q) => q.eq("profileId", profileId).eq("otherId", otherId))
    .unique();
}

export async function newConnectCode(ctx: MutationCtx) {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    const taken = await ctx.db
      .query("profiles")
      .withIndex("by_connect_code", (q) => q.eq("connectCode", code))
      .first();
    if (!taken) return code;
  }
}

// Connects two profiles both ways. Returns false if they were already connected.
export async function connect(
  ctx: MutationCtx,
  a: Id<"profiles">,
  b: Id<"profiles">,
  source: Doc<"profileConnections">["source"],
  at?: At,
) {
  if (a === b || (await row(ctx, a, b))) return false;
  const createdAt = Date.now();
  await ctx.db.insert("profileConnections", { profileId: a, otherId: b, source, by: a, createdAt });
  if (!(await row(ctx, b, a))) {
    await ctx.db.insert("profileConnections", { profileId: b, otherId: a, source, by: a, createdAt });
  }
  if (at) await record(ctx, at.eventId, "connection_made", at.userId);
  return true;
}

export async function disconnect(ctx: MutationCtx, a: Id<"profiles">, b: Id<"profiles">) {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    const r = await row(ctx, x, y);
    if (r) await ctx.db.delete("profileConnections", r._id);
  }
}

const atArgs = { eventId: v.optional(v.id("events")), userId: v.optional(v.id("users")) };
const atOf = (eventId?: Id<"events">, userId?: Id<"users">) => (eventId && userId ? { eventId, userId } : undefined);

// Typing a friend's code, or opening their invite link. Handing over the code
// is their consent.
export const connectByCode = mutation({
  args: { profileId: v.id("profiles"), code: v.string(), ...atArgs },
  returns: v.object({ name: v.string(), isNew: v.boolean() }),
  handler: async (ctx, { profileId, code, eventId, userId }) => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== CODE_LENGTH) throw new ConvexError(`Codes are ${CODE_LENGTH} letters and numbers.`);
    const other = await ctx.db
      .query("profiles")
      .withIndex("by_connect_code", (q) => q.eq("connectCode", clean))
      .first();
    if (!other) throw new ConvexError("No one has that code.");
    if (other._id === profileId) throw new ConvexError("That's your own code.");
    const isNew = await connect(ctx, profileId, other._id, "code", atOf(eventId, userId));
    return { name: other.name, isNew };
  },
});

export const remove = mutation({
  args: { profileId: v.id("profiles"), otherId: v.id("profiles") },
  returns: v.null(),
  handler: async (ctx, { profileId, otherId }) => {
    await disconnect(ctx, profileId, otherId);
    return null;
  },
});

// The profiles I'm connected with, newest first.
export const mine = query({
  args: { profileId: v.string() },
  returns: v.array(
    v.object({
      otherId: v.id("profiles"),
      name: v.string(),
      source: v.union(v.literal("huddle"), v.literal("code"), v.literal("demo")),
      by: v.optional(v.id("profiles")),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    const id = ctx.db.normalizeId("profiles", profileId);
    if (!id) return [];
    const rows = await ctx.db
      .query("profileConnections")
      .withIndex("by_profile_and_other", (q) => q.eq("profileId", id))
      .take(500);
    const out = [];
    for (const r of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const other = await ctx.db.get("profiles", r.otherId);
      if (other) out.push({ otherId: r.otherId, name: other.name, source: r.source, by: r.by, createdAt: r.createdAt });
    }
    return out;
  },
});
