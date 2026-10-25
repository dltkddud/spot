import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { matchSuggestion } from "./schema";
import { record } from "./activity";
import { shareWithOf } from "./users";

// AI matching: people write what they want to learn today and what they can
// share; matchesNode.suggest asks Claude who fits. From a match, people open
// the other person's page and send a normal chat request.

const MAX_CANDIDATES = 15;
const OPEN = ["proposed", "accepted", "started"] as const;

export const BASES = [
  "you.learnToday",
  "you.canShare",
  "you.interests",
  "you.headline",
  "you.talkTitle",
  "them.learnToday",
  "them.canShare",
  "them.interests",
  "them.headline",
  "them.talkTitle",
];

const personValidator = v.object({
  id: v.id("users"),
  name: v.string(),
  role: v.union(v.literal("speaker"), v.literal("guest")),
  status: v.union(v.literal("available"), v.literal("talking"), v.literal("leaving")),
  headline: v.string(),
  talkTitle: v.optional(v.string()),
  interests: v.array(v.string()),
  learnToday: v.optional(v.string()),
  canShare: v.optional(v.string()),
});

export type MatchPerson = typeof personValidator.type;
export type Suggestion = typeof matchSuggestion.type;

const first = (name: string) => name.split(" ")[0];
const overlap = (a: string[], b: string[]) => a.filter((i) => b.includes(i));

const STOP = new Set(["about", "with", "from", "that", "this", "what", "your", "have", "into", "first", "they", "them", "their", "would", "could", "like", "learn", "share", "today", "make", "more", "some"]);
const words = (s?: string) =>
  new Set((s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));

// How much what I want to learn meets what they can share, and the other way
// round. Only used to choose which people Claude gets to look at.
function fit(me: MatchPerson, p: MatchPerson) {
  const shared = (a?: string, b?: string) => [...words(a)].filter((w) => words(b).has(w)).length;
  return shared(me.learnToday, p.canShare) + shared(me.canShare, p.learnToday);
}

async function personOf(ctx: QueryCtx, u: Doc<"users">): Promise<MatchPerson | null> {
  const profile = u.profileId ? await ctx.db.get("profiles", u.profileId) : null;
  if (!profile) return null;
  return {
    id: u._id,
    name: profile.name,
    role: u.role === "panel" ? "speaker" : "guest",
    status: u.status,
    headline: profile.headline,
    talkTitle: u.talkTitle,
    interests: profile.interests,
    learnToday: u.learnToday,
    canShare: u.canShare,
  };
}

async function openMatchesOf(ctx: QueryCtx, userId: Id<"users">, statuses: readonly Doc<"matches">["status"][] = OPEN) {
  const out: Doc<"matches">[] = [];
  for (const status of statuses) {
    for (const index of ["by_from_and_status", "by_to_and_status"] as const) {
      const field = index === "by_from_and_status" ? "fromId" : "toId";
      out.push(
        ...(await ctx.db
          .query("matches")
          .withIndex(index, (q) => q.eq(field, userId).eq("status", status))
          .take(50)),
      );
    }
  }
  return out;
}

const otherOf = (m: Doc<"matches">, userId: Id<"users">) => (m.fromId === userId ? m.toId : m.fromId);

// Matching by shared interests: used when Claude isn't available, or answers
// with nothing usable. Shown as "Based on shared interests".
export function interestMatches(me: MatchPerson, candidates: MatchPerson[]): Suggestion[] {
  return candidates
    .map((c) => ({ c, shared: overlap(me.interests, c.interests) }))
    .filter((x) => x.shared.length > 0)
    .sort((a, b) => Number(b.c.status === "available") - Number(a.c.status === "available") || b.shared.length - a.shared.length)
    .slice(0, 3)
    .map(({ c, shared }) => {
      const topic = shared.slice(0, 2).join(" and ");
      return {
        otherId: c.id,
        direction: "both" as const,
        pairSummary: `${first(me.name)} and ${first(c.name)} both listed ${topic}.`,
        reasonForMe: `${first(c.name)} is into ${topic} too.`,
        reasonForThem: `${first(me.name)} is into ${topic} too.`,
        questionForMe: `What got you into ${shared[0]}?`,
        questionForThem: `What got you into ${shared[0]}?`,
        basedOn: ["you.interests", "them.interests"],
      };
    });
}

// Everything the matcher needs: me, the people I can see at this event (not
// hidden from me, not already in an open match with me), and my saved result.
export const inputs = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      eventId: v.id("events"),
      me: personValidator,
      candidates: v.array(personValidator),
      savedKey: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) return null;
    const me = await personOf(ctx, user);
    if (!me) return null;

    const connected = new Set<Id<"profiles">>();
    if (user.profileId) {
      const links = await ctx.db
        .query("profileConnections")
        .withIndex("by_profile_and_other", (q) => q.eq("profileId", user.profileId!))
        .take(500);
      links.forEach((l) => connected.add(l.otherId));
    }
    const busy = new Set((await openMatchesOf(ctx, userId)).map((m) => otherOf(m, userId)));

    const people = await ctx.db
      .query("users")
      .withIndex("by_event", (q) => q.eq("eventId", user.eventId))
      .take(1000);
    const candidates: MatchPerson[] = [];
    for (const u of people) {
      if (u._id === userId || busy.has(u._id) || !u.profileId) continue;
      const share = shareWithOf(u);
      if (share === "nobody" || (share === "connections" && !connected.has(u.profileId))) continue;
      const person = await personOf(ctx, u);
      if (person) candidates.push(person);
    }
    // Claude sees the most promising people: what they wrote meets what I
    // wrote, then free people, people who wrote anything, shared interests.
    const said = (p: MatchPerson) => Number(!!p.learnToday) + Number(!!p.canShare);
    candidates.sort(
      (a, b) =>
        fit(me, b) - fit(me, a) ||
        Number(b.status === "available") - Number(a.status === "available") ||
        said(b) - said(a) ||
        overlap(me.interests, b.interests).length - overlap(me.interests, a.interests).length,
    );

    const saved = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return { eventId: user.eventId, me, candidates: candidates.slice(0, MAX_CANDIDATES), savedKey: saved?.key };
  },
});

export const saveSet = internalMutation({
  args: {
    userId: v.id("users"),
    eventId: v.id("events"),
    key: v.string(),
    source: v.union(v.literal("claude"), v.literal("interests")),
    items: v.array(matchSuggestion),
  },
  returns: v.null(),
  handler: async (ctx, { userId, eventId, key, source, items }) => {
    const existing = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const row = { eventId, userId, key, source, items, createdAt: Date.now() };
    if (existing) await ctx.db.replace("matchSets", existing._id, row);
    else await ctx.db.insert("matchSets", row);
    return null;
  },
});

// My AI matches.
export const forMe = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      source: v.union(v.literal("claude"), v.literal("interests")),
      items: v.array(matchSuggestion),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const saved = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return saved ? { source: saved.source, items: saved.items, createdAt: saved.createdAt } : null;
  },
});

// "What I want to learn today" / "What I can share". Empty clears.
export const setInputs = mutation({
  args: { userId: v.id("users"), learnToday: v.string(), canShare: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, learnToday, canShare }) => {
    await ctx.db.patch("users", userId, {
      learnToday: learnToday.trim().slice(0, 140) || undefined,
      canShare: canShare.trim().slice(0, 140) || undefined,
    });
    return null;
  },
});

// "Not now" on one of my AI matches: hide it.
export const dismiss = mutation({
  args: { userId: v.id("users"), otherId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId, otherId }) => {
    const set = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (set) await ctx.db.patch("matchSets", set._id, { items: set.items.filter((i) => i.otherId !== otherId) });
    return null;
  },
});

// 10-min chats suggested or started before they were removed: jobs already
// scheduled still close them.
export const finish = internalMutation({
  args: { matchId: v.id("matches"), endsAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { matchId, endsAt }) => {
    const m = await ctx.db.get("matches", matchId);
    if (!m || m.status !== "started" || m.endsAt !== endsAt) return null;
    await ctx.db.patch("matches", matchId, { status: "done" });
    await record(ctx, m.eventId, "match_completed", m.fromId, m.toId);
    return null;
  },
});

export const expire = internalMutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const m = await ctx.db.get("matches", matchId);
    if (m?.status === "proposed") await ctx.db.patch("matches", matchId, { status: "expired" });
    return null;
  },
});

// Someone left the event (or switched to another one): their open chats end.
export async function cancelMatchesFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  statuses: readonly Doc<"matches">["status"][] = OPEN,
) {
  for (const m of await openMatchesOf(ctx, userId, statuses)) {
    await ctx.db.patch("matches", m._id, { status: "cancelled" });
  }
}
