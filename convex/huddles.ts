import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { record } from "./activity";
import { closeWithoutChat } from "./followUps";

// A huddle is 2-3 people in the same speaker's line who'd get more from
// meeting the speaker together: Claude groups them from what they wrote
// (huddlesNode.match), with shared interests as the fallback. Answers and line
// position happen here; screens only read the queries at the bottom.

const MAX_MEMBERS = 3;

type Huddle = Doc<"huddles">;
type Member = Doc<"huddleMembers">;
// Someone waiting in a line, with the interests from their profile.
type Candidate = { request: Doc<"chatRequests">; user: Doc<"users">; interests: string[] };

const isOpen = (h: Huddle) => h.status === "proposed" || h.status === "formed";
const overlap = (a: string[], b: string[]) => a.filter((i) => b.includes(i));
const pairKey = (a: Id<"users">, b: Id<"users">) => (a < b ? `${a}|${b}` : `${b}|${a}`);

async function membersOf(ctx: QueryCtx, huddleId: Id<"huddles">) {
  return await ctx.db
    .query("huddleMembers")
    .withIndex("by_huddle", (q) => q.eq("huddleId", huddleId))
    .take(MAX_MEMBERS + 1);
}

// The open huddle a request belongs to, if any.
async function openHuddleOf(ctx: QueryCtx, requestId: Id<"chatRequests">) {
  const rows = await ctx.db
    .query("huddleMembers")
    .withIndex("by_request", (q) => q.eq("requestId", requestId))
    .take(20);
  for (const m of rows) {
    const h = await ctx.db.get("huddles", m.huddleId);
    if (h && isOpen(h)) return h;
  }
  return null;
}

async function end(ctx: MutationCtx, huddle: Huddle, status: "declined" | "dissolved" | "met") {
  await ctx.db.patch("huddles", huddle._id, { status });
  if (status === "met") return;
  // Everyone goes back to their own place in line.
  for (const m of await membersOf(ctx, huddle._id)) {
    const req = await ctx.db.get("chatRequests", m.requestId);
    if (req?.huddleId === huddle._id) {
      await ctx.db.patch("chatRequests", req._id, { huddleId: undefined, lineAt: undefined });
    }
  }
}

// When everyone said yes: one place in line, at the earliest member's spot.
async function formIfReady(ctx: MutationCtx, huddleId: Id<"huddles">) {
  const huddle = await ctx.db.get("huddles", huddleId);
  if (!huddle || huddle.status !== "proposed") return;
  const members = await membersOf(ctx, huddleId);
  if (members.length < 2 || members.some((m) => m.response !== "yes")) return;

  const requests = await Promise.all(members.map((m) => ctx.db.get("chatRequests", m.requestId)));
  if (requests.some((r) => !r || r.status !== "waiting")) return await end(ctx, huddle, "dissolved");
  const lineAt = Math.min(...requests.map((r) => r!.createdAt));
  for (const r of requests) await ctx.db.patch("chatRequests", r!._id, { huddleId, lineAt });
  await ctx.db.patch("huddles", huddleId, { status: "formed", formedAt: Date.now() });
  await record(ctx, huddle.eventId, "huddle_formed", members[0].userId, huddle.panelId);
}

async function addMember(ctx: MutationCtx, huddleId: Id<"huddles">, c: { request: Doc<"chatRequests">; user: Doc<"users"> }) {
  await ctx.db.insert("huddleMembers", {
    huddleId,
    userId: c.user._id,
    requestId: c.request._id,
    response: "pending",
  });
}

// What a speaker's line looks like for matching: pairs already suggested for
// this speaker (never suggested again), requests already in an open huddle,
// and open suggestions.
async function lineState(ctx: QueryCtx, panelId: Id<"users">) {
  const seen = new Set<string>();
  const busy = new Set<Id<"chatRequests">>();
  const proposed: { huddle: Huddle; members: Member[] }[] = [];
  const history = await ctx.db
    .query("huddles")
    .withIndex("by_panel_and_status", (q) => q.eq("panelId", panelId))
    .take(500);
  for (const huddle of history) {
    const members = await membersOf(ctx, huddle._id);
    for (const a of members) for (const b of members) if (a.userId !== b.userId) seen.add(pairKey(a.userId, b.userId));
    if (isOpen(huddle)) members.forEach((m) => busy.add(m.requestId));
    if (huddle.status === "proposed") proposed.push({ huddle, members });
  }
  return { seen, busy, proposed };
}

// Everyone waiting in the line who could be in a new huddle: not in one
// already, and open to huddles. Earliest first.
async function poolOf(ctx: QueryCtx, panelId: Id<"users">, busy: Set<Id<"chatRequests">>) {
  const waiting = await ctx.db
    .query("chatRequests")
    .withIndex("by_panel_status", (q) => q.eq("panelId", panelId).eq("status", "waiting"))
    .take(200);
  const pool: (Candidate & { profile: Doc<"profiles"> | null })[] = [];
  for (const request of waiting) {
    if (busy.has(request._id)) continue;
    const user = await ctx.db.get("users", request.attendeeId);
    if (!user) continue;
    const profile = user.profileId ? await ctx.db.get("profiles", user.profileId) : null;
    if (profile?.openToHuddles !== false) pool.push({ request, user, interests: profile?.interests ?? [], profile });
  }
  return pool.sort((a, b) => a.request.createdAt - b.request.createdAt);
}

// Something changed in a speaker's line: Claude looks at it (huddlesNode.match),
// and its groups come back through applyMatch.
export async function proposeFor(ctx: MutationCtx, panelId: Id<"users">) {
  await ctx.scheduler.runAfter(0, internal.huddlesNode.match, { panelId });
}

// The fallback when Claude isn't available: fills open suggestions first (up
// to 3 people), then pairs the earliest waiting people with whoever shares the
// most interests. The same two people are never suggested twice for the same
// speaker, and people who turned huddles off are skipped.
export async function proposeByInterests(ctx: MutationCtx, panelId: Id<"users">) {
  const panel = await ctx.db.get("users", panelId);
  if (!panel || !panel.visible) return;
  const { seen, busy, proposed } = await lineState(ctx, panelId);
  const pool: Candidate[] = await poolOf(ctx, panelId, busy);

  const best = (with_: Id<"users">[], interests: string[]) => {
    let pick: Candidate | undefined;
    let score = 0;
    for (const c of pool) {
      if (with_.some((id) => seen.has(pairKey(id, c.user._id)))) continue;
      const n = overlap(c.interests, interests).length;
      if (n > score) [pick, score] = [c, n];
    }
    if (pick) pool.splice(pool.indexOf(pick), 1);
    return pick;
  };

  // Groups Claude made keep just the people Claude explained.
  for (const { huddle, members } of proposed) {
    if (huddle.source === "claude") continue;
    const ids = members.map((m) => m.userId);
    let shared = huddle.sharedInterests;
    let added = false;
    while (ids.length < MAX_MEMBERS) {
      const c = best(ids, shared);
      if (!c) break;
      await addMember(ctx, huddle._id, c);
      ids.push(c.user._id);
      shared = overlap(shared, c.interests);
      added = true;
    }
    if (!added) continue;
    await ctx.db.patch("huddles", huddle._id, { sharedInterests: shared });
  }

  while (pool.length >= 2) {
    const first = pool.shift()!;
    const second = best([first.user._id], first.interests);
    if (!second) continue;
    const group = [first, second];
    let shared = overlap(first.interests, second.interests);
    const third = best([first.user._id, second.user._id], shared);
    if (third) {
      group.push(third);
      shared = overlap(shared, third.interests);
    }
    const huddleId = await ctx.db.insert("huddles", {
      eventId: panel.eventId,
      panelId,
      status: "proposed",
      sharedInterests: shared,
      source: "interests",
      createdAt: Date.now(),
    });
    for (const c of group) await addMember(ctx, huddleId, c);
    await record(ctx, panel.eventId, "huddle_proposed", first.user._id, panelId);
  }
}

// FNV-1a: a short key for "everything that went into this result".
function hashKey(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const linePerson = v.object({
  requestId: v.id("chatRequests"),
  userId: v.id("users"),
  name: v.string(),
  headline: v.string(),
  interests: v.array(v.string()),
  learnToday: v.optional(v.string()),
  canShare: v.optional(v.string()),
  note: v.string(),
});

// What Claude gets for one speaker's line (see prompts/huddle.md), and a key
// for it: when the key is the one Claude last saw, nothing is sent again.
export const lineFor = internalQuery({
  args: { panelId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      key: v.string(),
      lastKey: v.optional(v.string()),
      speaker: v.object({ name: v.string(), headline: v.string(), talkTitle: v.optional(v.string()) }),
      people: v.array(linePerson),
      neverTogether: v.array(v.array(v.id("users"))),
    }),
  ),
  handler: async (ctx, { panelId }) => {
    const panel = await ctx.db.get("users", panelId);
    if (!panel || !panel.visible) return null;
    const panelProfile = panel.profileId ? await ctx.db.get("profiles", panel.profileId) : null;
    const { seen, busy } = await lineState(ctx, panelId);
    const pool = await poolOf(ctx, panelId, busy);
    const people = pool.map((c) => ({
      requestId: c.request._id,
      userId: c.user._id,
      name: c.profile?.name ?? "Guest",
      headline: c.profile?.headline ?? "",
      interests: c.interests,
      learnToday: c.user.learnToday,
      canShare: c.user.canShare,
      note: c.request.note,
    }));
    const ids = new Set<string>(people.map((p) => p.userId));
    const neverTogether = [...seen]
      .map((k) => k.split("|") as Id<"users">[])
      .filter(([a, b]) => a < b && ids.has(a) && ids.has(b));
    const last = await ctx.db
      .query("huddleChecks")
      .withIndex("by_panel", (q) => q.eq("panelId", panelId))
      .first();
    const speaker = { name: panelProfile?.name ?? "The speaker", headline: panelProfile?.headline ?? "", talkTitle: panel.talkTitle };
    return {
      key: hashKey(JSON.stringify([speaker, people, neverTogether])),
      lastKey: last?.key,
      speaker,
      people,
      neverTogether,
    };
  },
});

// Claude's groups for a line, or the fallback. Everything is checked again,
// since the line may have changed while Claude was thinking.
export const applyMatch = internalMutation({
  args: {
    panelId: v.id("users"),
    key: v.string(),
    fallback: v.boolean(),
    groups: v.array(
      v.object({
        requestIds: v.array(v.id("chatRequests")),
        whyYou: v.array(v.string()),
        reason: v.string(),
        sharedQuestion: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { panelId, key, fallback, groups }) => {
    const check = await ctx.db
      .query("huddleChecks")
      .withIndex("by_panel", (q) => q.eq("panelId", panelId))
      .first();
    if (check) await ctx.db.patch("huddleChecks", check._id, { key, createdAt: Date.now() });
    else await ctx.db.insert("huddleChecks", { panelId, key, createdAt: Date.now() });

    if (fallback) {
      await proposeByInterests(ctx, panelId);
      return null;
    }
    const panel = await ctx.db.get("users", panelId);
    if (!panel || !panel.visible) return null;
    const { seen, busy } = await lineState(ctx, panelId);
    const pool = await poolOf(ctx, panelId, busy);
    for (const g of groups) {
      const members = g.requestIds.map((id) => pool.find((c) => c.request._id === id));
      if (members.length < 2 || members.length > MAX_MEMBERS || members.some((m) => !m)) continue;
      const group = members as typeof pool;
      if (group.some((a) => group.some((b) => a !== b && seen.has(pairKey(a.user._id, b.user._id))))) continue;
      const huddleId = await ctx.db.insert("huddles", {
        eventId: panel.eventId,
        panelId,
        status: "proposed",
        sharedInterests: group.map((c) => c.interests).reduce((a, b) => overlap(a, b)),
        source: "claude",
        reason: g.reason,
        sharedQuestion: g.sharedQuestion,
        createdAt: Date.now(),
      });
      for (const [i, c] of group.entries()) {
        await ctx.db.insert("huddleMembers", {
          huddleId,
          userId: c.user._id,
          requestId: c.request._id,
          response: "pending",
          whyYou: g.whyYou[i] || undefined,
        });
        pool.splice(pool.indexOf(c), 1);
      }
      for (const a of group) for (const b of group) if (a !== b) seen.add(pairKey(a.user._id, b.user._id));
      await record(ctx, panel.eventId, "huddle_proposed", group[0].user._id, panelId);
    }
    return null;
  },
});

// Called after a chat request changes. A member leaving the line, being
// declined, or being called up alone ends their huddle; everyone else goes
// back to their own request and may be matched again.
export async function afterRequestChange(ctx: MutationCtx, requestId: Id<"chatRequests">) {
  const req = await ctx.db.get("chatRequests", requestId);
  if (!req) return;
  const huddle = await openHuddleOf(ctx, requestId);
  if (!huddle) return;

  if (req.status === "met") {
    const members = await membersOf(ctx, huddle._id);
    const requests = await Promise.all(members.map((m) => ctx.db.get("chatRequests", m.requestId)));
    if (requests.every((r) => r?.status === "met")) await end(ctx, huddle, "met");
    return;
  }
  if (req.status === "accepted" && huddle.status === "formed") return;
  await end(ctx, huddle, "dissolved");
  if (req.status !== "missed") await proposeFor(ctx, huddle.panelId);
}

// The speaker is leaving: every open huddle in their line breaks up.
export async function dissolveAllFor(ctx: MutationCtx, panelId: Id<"users">) {
  for (const status of ["proposed", "formed"] as const) {
    const open = await ctx.db
      .query("huddles")
      .withIndex("by_panel_and_status", (q) => q.eq("panelId", panelId).eq("status", status))
      .take(200);
    for (const h of open) await end(ctx, h, "dissolved");
  }
}

// "Huddle up" / "Not this time".
export const respond = mutation({
  args: { huddleId: v.id("huddles"), userId: v.id("users"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { huddleId, userId, accept }) => {
    const huddle = await ctx.db.get("huddles", huddleId);
    if (!huddle || huddle.status !== "proposed") throw new ConvexError("This huddle has already changed.");
    const me = (await membersOf(ctx, huddleId)).find((m) => m.userId === userId);
    if (!me) throw new ConvexError("You're not in this huddle.");

    await ctx.db.patch("huddleMembers", me._id, { response: accept ? "yes" : "no" });
    if (accept) {
      await formIfReady(ctx, huddleId);
    } else {
      await end(ctx, huddle, "declined");
      await proposeFor(ctx, huddle.panelId);
    }
    return null;
  },
});

// The speaker accepts, declines, or marks a whole huddle at once.
export const setGroupStatus = mutation({
  args: {
    huddleId: v.id("huddles"),
    actorId: v.id("users"),
    status: v.union(v.literal("accepted"), v.literal("declined"), v.literal("met"), v.literal("missed")),
  },
  returns: v.null(),
  handler: async (ctx, { huddleId, actorId, status }) => {
    const huddle = await ctx.db.get("huddles", huddleId);
    if (!huddle || huddle.status !== "formed") throw new ConvexError("This huddle has already changed.");
    if (huddle.panelId !== actorId) throw new ConvexError("Only the speaker can do that.");

    const now = Date.now();
    for (const m of await membersOf(ctx, huddleId)) {
      const req = await ctx.db.get("chatRequests", m.requestId);
      if (!req) continue;
      const ok = status === "accepted" ? req.status === "waiting" : req.status === "waiting" || req.status === "accepted";
      if (!ok) continue;
      if (status === "declined" || status === "missed") await closeWithoutChat(ctx, req._id, status, status);
      else await ctx.db.patch("chatRequests", req._id, { status, ...(status === "accepted" && { acceptedAt: now }) });
    }
    if (status === "met") await end(ctx, huddle, "met");
    else if (status !== "accepted") await end(ctx, huddle, "dissolved");
    return null;
  },
});

const memberValidator = v.object({
  userId: v.id("users"),
  requestId: v.id("chatRequests"),
  response: v.union(v.literal("pending"), v.literal("yes"), v.literal("no")),
  whyYou: v.optional(v.string()),
});

const huddleValidator = v.object({
  _id: v.id("huddles"),
  panelId: v.id("users"),
  status: v.union(v.literal("proposed"), v.literal("formed")),
  sharedInterests: v.array(v.string()),
  source: v.union(v.literal("claude"), v.literal("interests")),
  reason: v.optional(v.string()),
  sharedQuestion: v.optional(v.string()),
  members: v.array(memberValidator),
});

// Members see the reason and their own whyYou; the speaker also sees the
// shared question (which may draw on notes only the speaker sees).
async function view(ctx: QueryCtx, huddle: Huddle, viewer: { userId: Id<"users"> } | "speaker") {
  const members = await membersOf(ctx, huddle._id);
  return {
    _id: huddle._id,
    panelId: huddle.panelId,
    status: huddle.status as "proposed" | "formed",
    sharedInterests: huddle.sharedInterests,
    source: huddle.source ?? ("interests" as const),
    reason: huddle.reason,
    sharedQuestion: viewer === "speaker" ? huddle.sharedQuestion : undefined,
    members: members.map(({ userId, requestId, response, whyYou }) => ({
      userId,
      requestId,
      response,
      whyYou: viewer !== "speaker" && viewer.userId === userId ? whyYou : undefined,
    })),
  };
}

// An attendee's open huddles. Only names come through user ids; nobody's note is included.
export const forAttendee = query({
  args: { attendeeId: v.id("users") },
  returns: v.array(huddleValidator),
  handler: async (ctx, { attendeeId }) => {
    const rows = await ctx.db
      .query("huddleMembers")
      .withIndex("by_user", (q) => q.eq("userId", attendeeId))
      .order("desc")
      .take(30);
    const out = [];
    for (const m of rows) {
      const huddle = await ctx.db.get("huddles", m.huddleId);
      if (huddle && isOpen(huddle)) out.push(await view(ctx, huddle, { userId: attendeeId }));
    }
    return out;
  },
});

// Formed huddles in a speaker's line, shown to the speaker as one card each.
export const forPanel = query({
  args: { panelId: v.id("users") },
  returns: v.array(huddleValidator),
  handler: async (ctx, { panelId }) => {
    const formed = await ctx.db
      .query("huddles")
      .withIndex("by_panel_and_status", (q) => q.eq("panelId", panelId).eq("status", "formed"))
      .take(50);
    return await Promise.all(formed.map((h) => view(ctx, h, "speaker")));
  },
});
