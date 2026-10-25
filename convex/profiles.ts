import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { newConnectCode } from "./connections";
import { proposeFor } from "./huddles";

// A profile is a person across every event: name, one line, interests, links,
// connect code. What they do at a given event lives in users (one row per event).

const LINKEDIN = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/\S+$/i;
// What a new or edited profile needs: a personal profile link, linkedin.com/in/<name>.
const LINKEDIN_PROFILE = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/in\/[^\s/?#]+\/?([?#]\S*)?$/i;

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

// LinkedIn is required and is how people log back in, so every way of writing
// the same link (http, no www, trailing slash, ?query, capitals) becomes one:
// https://www.linkedin.com/in/yourname
export function cleanLinkedin(url: string | undefined) {
  const t = url?.trim();
  if (!t) throw new ConvexError("Add your LinkedIn, so people you miss can still reach you.");
  if (!LINKEDIN_PROFILE.test(t)) throw new ConvexError("That doesn't look like a LinkedIn profile link (linkedin.com/in/…).");
  const path = t
    .replace(/^.*?linkedin\.com/i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  if (!path) throw new ConvexError("That doesn't look like a LinkedIn link (linkedin.com/in/…).");
  return `https://www.linkedin.com${path}`;
}

async function profileWithLinkedin(ctx: QueryCtx, linkedinUrl: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_linkedin", (q) => q.eq("linkedinUrl", linkedinUrl))
    .first();
}

function cleanLink(url: string | undefined) {
  const t = url?.trim();
  return t ? (t.includes("@") && !t.includes("/") ? t : withScheme(t)) : undefined;
}

function cleanName(name: string) {
  const t = name.trim();
  if (!t) throw new ConvexError("Name is required.");
  return t;
}

export async function profileOf(ctx: QueryCtx, user: Doc<"users">) {
  return user.profileId ? await ctx.db.get("profiles", user.profileId) : null;
}

// Gives an older participation (made when name and links lived on users) its
// own profile, and clears the old copies. Used by the migration and by old
// browsers that only remember a participation id.
export async function profileFromLegacy(ctx: MutationCtx, u: Doc<"users">): Promise<Id<"profiles">> {
  if (u.profileId) return u.profileId;
  const link = u.contactUrl?.trim();
  const isLinkedin = !!link && LINKEDIN.test(link);
  const profileId = await ctx.db.insert("profiles", {
    name: u.name ?? "Guest",
    headline: u.headline ?? "",
    interests: u.interests ?? [],
    linkedinUrl: isLinkedin ? withScheme(link) : undefined,
    contactUrl: isLinkedin ? undefined : link || undefined,
    connectCode: u.connectCode ?? (await newConnectCode(ctx)),
    openToHuddles: u.openToHuddles,
    seedKey: u.seedKey,
    createdAt: u._creationTime,
  });
  await ctx.db.patch("users", u._id, {
    profileId,
    name: undefined,
    headline: undefined,
    interests: undefined,
    contactUrl: undefined,
    connectCode: undefined,
    openToHuddles: undefined,
  });
  return profileId;
}

export const profileValidator = v.object({
  _id: v.id("profiles"),
  name: v.string(),
  headline: v.string(),
  interests: v.array(v.string()),
  linkedinUrl: v.optional(v.string()),
  contactUrl: v.optional(v.string()),
  connectCode: v.optional(v.string()),
  openToHuddles: v.optional(v.boolean()),
});

const toView = (p: Doc<"profiles">) => ({
  _id: p._id,
  name: p.name,
  headline: p.headline,
  interests: p.interests,
  linkedinUrl: p.linkedinUrl,
  contactUrl: p.contactUrl,
  connectCode: p.connectCode,
  openToHuddles: p.openToHuddles,
});

// First run: the profile that every event will share. One profile per LinkedIn.
export const create = mutation({
  args: {
    name: v.string(),
    headline: v.string(),
    interests: v.array(v.string()),
    linkedinUrl: v.string(),
    contactUrl: v.optional(v.string()),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const linkedinUrl = cleanLinkedin(args.linkedinUrl);
    if (await profileWithLinkedin(ctx, linkedinUrl)) {
      throw new ConvexError("That LinkedIn is already on Spot. Log in instead.");
    }
    return await ctx.db.insert("profiles", {
      name: cleanName(args.name),
      headline: args.headline.trim(),
      interests: args.interests,
      linkedinUrl,
      contactUrl: cleanLink(args.contactUrl),
      connectCode: await newConnectCode(ctx),
      createdAt: Date.now(),
    });
  },
});

// Me → Edit profile, and the huddle switch. Changes show at every event.
// An empty other link clears it; LinkedIn can change but never be empty.
export const update = mutation({
  args: {
    profileId: v.id("profiles"),
    name: v.optional(v.string()),
    headline: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
    linkedinUrl: v.optional(v.string()),
    contactUrl: v.optional(v.string()),
    openToHuddles: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { profileId, name, headline, interests, linkedinUrl, contactUrl, openToHuddles }) => {
    const profile = await ctx.db.get("profiles", profileId);
    if (!profile) throw new ConvexError("Profile not found.");
    const linkedin = linkedinUrl !== undefined ? cleanLinkedin(linkedinUrl) : undefined;
    if (linkedin && linkedin !== profile.linkedinUrl) {
      const taken = await profileWithLinkedin(ctx, linkedin);
      if (taken && taken._id !== profileId) throw new ConvexError("Someone else on Spot already uses that LinkedIn.");
    }
    await ctx.db.patch("profiles", profileId, {
      ...(name !== undefined && { name: cleanName(name) }),
      ...(headline !== undefined && { headline: headline.trim() }),
      ...(interests !== undefined && { interests }),
      ...(linkedin !== undefined && { linkedinUrl: linkedin }),
      ...(contactUrl !== undefined && { contactUrl: cleanLink(contactUrl) }),
      ...(openToHuddles !== undefined && { openToHuddles }),
    });
    // Turning huddles back on, or new interests: look for matches in every line I'm in.
    if ((openToHuddles && profile.openToHuddles === false) || interests !== undefined) {
      const mine = await ctx.db
        .query("users")
        .withIndex("by_profile_and_event", (q) => q.eq("profileId", profileId))
        .take(100);
      for (const u of mine) {
        const requests = await ctx.db
          .query("chatRequests")
          .withIndex("by_attendee", (q) => q.eq("attendeeId", u._id))
          .take(200);
        for (const r of requests) if (r.status === "waiting") await proposeFor(ctx, r.panelId);
      }
    }
    return null;
  },
});

// "Log in": no passwords at a hackathon, so the LinkedIn link finds the profile.
export const logIn = mutation({
  args: { linkedinUrl: v.string() },
  returns: v.id("profiles"),
  handler: async (ctx, { linkedinUrl }) => {
    const profile = await profileWithLinkedin(ctx, cleanLinkedin(linkedinUrl));
    if (!profile) throw new ConvexError("No profile with that LinkedIn yet. Get started to make one.");
    return profile._id;
  },
});

export const get = query({
  args: { profileId: v.string() },
  returns: v.union(v.null(), profileValidator),
  handler: async (ctx, { profileId }) => {
    const id = ctx.db.normalizeId("profiles", profileId);
    const profile = id ? await ctx.db.get("profiles", id) : null;
    return profile ? toView(profile) : null;
  },
});

// The events I've joined, and my role at each.
export const participations = query({
  args: { profileId: v.string() },
  returns: v.array(
    v.object({
      eventId: v.id("events"),
      userId: v.id("users"),
      role: v.union(v.literal("panel"), v.literal("attendee")),
    }),
  ),
  handler: async (ctx, { profileId }) => {
    const id = ctx.db.normalizeId("profiles", profileId);
    if (!id) return [];
    const rows = await ctx.db
      .query("users")
      .withIndex("by_profile_and_event", (q) => q.eq("profileId", id))
      .take(100);
    return rows.map((u) => ({ eventId: u.eventId, userId: u._id, role: u.role }));
  },
});

// Browsers from before profiles remember a participation id. Carry them over.
export const claimFromParticipation = mutation({
  args: { userId: v.string() },
  returns: v.union(v.null(), v.id("profiles")),
  handler: async (ctx, { userId }) => {
    const id = ctx.db.normalizeId("users", userId);
    const user = id ? await ctx.db.get("users", id) : null;
    return user ? await profileFromLegacy(ctx, user) : null;
  },
});

// Profiles made before connect codes existed get one when they open the app.
export const ensureCode = mutation({
  args: { profileId: v.id("profiles") },
  returns: v.string(),
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get("profiles", profileId);
    if (!profile) throw new ConvexError("Profile not found.");
    if (profile.connectCode) return profile.connectCode;
    const code = await newConnectCode(ctx);
    await ctx.db.patch("profiles", profileId, { connectCode: code });
    return code;
  },
});
