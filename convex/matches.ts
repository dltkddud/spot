import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema, { matchSuggestion } from "./schema";
import { record } from "./activity";
import { shareWithOf } from "./users";

// AI matching: people write what they want to learn today and what they can
// share; matchesNode.suggest asks Claude who fits; either side can then
// suggest a 10-minute chat, and when both say yes, Spot sets it up and times it.

const MIN = 60_000;
const ANSWER_WITHIN_MIN = 15;
const CHAT_MIN = 10;
const MAX_OPEN_OFFERS = 3;
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

// My AI matches, and my open chats (plus finished ones I haven't closed yet).
export const forMe = query({
  args: { userId: v.id("users") },
  returns: v.object({
    set: v.union(
      v.null(),
      v.object({
        source: v.union(v.literal("claude"), v.literal("interests")),
        items: v.array(matchSuggestion),
        createdAt: v.number(),
      }),
    ),
    matches: v.array(schema.doc("matches")),
  }),
  handler: async (ctx, { userId }) => {
    const saved = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const matches = [
      ...(await openMatchesOf(ctx, userId)),
      ...(await openMatchesOf(ctx, userId, ["done"])).filter((m) => !m.wrappedUp.includes(userId)),
    ];
    return {
      set: saved ? { source: saved.source, items: saved.items, createdAt: saved.createdAt } : null,
      matches: matches.sort((a, b) => b.createdAt - a.createdAt),
    };
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

async function insertMatch(
  ctx: MutationCtx,
  eventId: Id<"events">,
  fromId: Id<"users">,
  toId: Id<"users">,
  s: Suggestion,
  source: Doc<"matches">["source"],
) {
  const matchId = await ctx.db.insert("matches", {
    eventId,
    fromId,
    toId,
    status: "proposed",
    direction: s.direction,
    pairSummary: s.pairSummary,
    reasonForFrom: s.reasonForMe,
    reasonForTo: s.reasonForThem,
    questionForFrom: s.questionForMe,
    questionForTo: s.questionForThem,
    basedOn: s.basedOn,
    source,
    createdAt: Date.now(),
    wrappedUp: [],
  });
  await ctx.scheduler.runAfter(ANSWER_WITHIN_MIN * MIN, internal.matches.expire, { matchId });
  await record(ctx, eventId, "match_suggested", fromId, toId);
  return matchId;
}

// "Suggest a 10-min chat" on one of my AI matches.
export const propose = mutation({
  args: { fromId: v.id("users"), toId: v.id("users") },
  returns: v.id("matches"),
  handler: async (ctx, { fromId, toId }) => {
    const [from, to] = await Promise.all([ctx.db.get("users", fromId), ctx.db.get("users", toId)]);
    if (!from || !to || from.eventId !== to.eventId) throw new ConvexError("They're not at this event anymore.");
    const set = await ctx.db
      .query("matchSets")
      .withIndex("by_user", (q) => q.eq("userId", fromId))
      .first();
    const s = set?.items.find((i) => i.otherId === toId);
    if (!set || !s) throw new ConvexError("Find matches first, then try this again.");
    const mine = await openMatchesOf(ctx, fromId);
    if (mine.some((m) => otherOf(m, fromId) === toId)) throw new ConvexError("You already have a chat going with them.");
    if (mine.filter((m) => m.fromId === fromId && m.status === "proposed").length >= MAX_OPEN_OFFERS) {
      throw new ConvexError(`You can have ${MAX_OPEN_OFFERS} suggestions out at once. Wait for an answer first.`);
    }
    return await insertMatch(ctx, from.eventId, fromId, toId, s, set.source);
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

async function accept(ctx: MutationCtx, m: Doc<"matches">) {
  const [from, to] = await Promise.all([ctx.db.get("users", m.fromId), ctx.db.get("users", m.toId)]);
  await ctx.db.patch("matches", m._id, {
    status: "accepted",
    respondedAt: Date.now(),
    meetZoneId: to?.zoneId ?? from?.zoneId,
  });
  await record(ctx, m.eventId, "match_accepted", m.toId, m.fromId);
}

// "Yes, 10 min" / "Not now" from the person a chat was suggested to.
export const respond = mutation({
  args: { matchId: v.id("matches"), userId: v.id("users"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { matchId, userId, accept: yes }) => {
    const m = await ctx.db.get("matches", matchId);
    if (!m || m.toId !== userId) throw new ConvexError("That suggestion isn't for you.");
    if (m.status !== "proposed") throw new ConvexError("That suggestion has already changed.");
    if (yes) await accept(ctx, m);
    else await ctx.db.patch("matches", matchId, { status: "declined", respondedAt: Date.now() });
    return null;
  },
});

async function setTalking(ctx: MutationCtx, userId: Id<"users">, status: "talking" | "available") {
  const u = await ctx.db.get("users", userId);
  // Someone on their way out keeps their leaving time.
  if (u && u.status !== "leaving") await ctx.db.patch("users", userId, { status, updatedAt: Date.now() });
}

// "Start 10-min chat": both people show as in a conversation and the timer runs.
export const start = mutation({
  args: { matchId: v.id("matches"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { matchId, userId }) => {
    const m = await ctx.db.get("matches", matchId);
    if (!m || (m.fromId !== userId && m.toId !== userId)) throw new ConvexError("That chat isn't yours.");
    if (m.status !== "accepted") throw new ConvexError("That chat has already changed.");
    const startedAt = Date.now();
    const endsAt = startedAt + CHAT_MIN * MIN;
    await ctx.db.patch("matches", matchId, { status: "started", startedAt, endsAt });
    await setTalking(ctx, m.fromId, "talking");
    await setTalking(ctx, m.toId, "talking");
    await ctx.scheduler.runAt(endsAt, internal.matches.finish, { matchId, endsAt });
    return null;
  },
});

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

// After "Time's up": "I'm free again" (back to available) or "Keep talking".
export const wrapUp = mutation({
  args: { matchId: v.id("matches"), userId: v.id("users"), free: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { matchId, userId, free }) => {
    const m = await ctx.db.get("matches", matchId);
    if (!m || (m.fromId !== userId && m.toId !== userId)) throw new ConvexError("That chat isn't yours.");
    if (!m.wrappedUp.includes(userId)) await ctx.db.patch("matches", matchId, { wrappedUp: [...m.wrappedUp, userId] });
    if (free) await setTalking(ctx, userId, "available");
    return null;
  },
});

// No answer within 15 minutes.
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

export const leaveEvent = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    await cancelMatchesFor(ctx, userId, ["proposed", "accepted"]);
    return null;
  },
});

