import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// When a speaker leaves with people still in line, each of those guests gets
// a short message they can send the speaker later. followUpsNode.draft writes
// it (Claude, or the template below); these read what it needs and save it.

export const contextValidator = v.object({
  eventName: v.string(),
  guestName: v.string(),
  guestHeadline: v.string(),
  note: v.string(),
  speakerName: v.string(),
  speakerHeadline: v.string(),
  talkTitle: v.optional(v.string()),
  sharedInterests: v.array(v.string()),
});

export type FollowUpContext = typeof contextValidator.type;

const first = (name: string) => name.split(" ")[0];

// The message used when Claude can't write one: same facts, fixed wording.
export function templateMessage(c: FollowUpContext) {
  const parts = [`Hi ${first(c.speakerName)}, I was in line to talk with you at ${c.eventName} but missed you before you left.`];
  if (c.talkTitle) parts.push(`I'd love to hear more about "${c.talkTitle}".`);
  const note = c.note.trim();
  if (note) {
    const question = /^[A-Z][a-z]/.test(note) ? note[0].toLowerCase() + note.slice(1) : note;
    parts.push(`I wanted to ask ${question}${/[.?!]$/.test(note) ? "" : "?"}`);
  }
  if (!note && c.sharedInterests.length > 0) parts.push(`I'm into ${c.sharedInterests.slice(0, 2).join(" and ")} too.`);
  parts.push(`Would you be open to a quick chat sometime? Thanks, ${first(c.guestName)}`);
  return parts.join(" ");
}

export const context = internalQuery({
  args: { requestId: v.id("chatRequests") },
  returns: v.union(v.null(), contextValidator),
  handler: async (ctx, { requestId }) => {
    const req = await ctx.db.get("chatRequests", requestId);
    if (!req || req.status !== "missed" || req.closedBecause !== "speaker_left") return null;
    const [guest, speaker, event] = await Promise.all([
      ctx.db.get("users", req.attendeeId),
      ctx.db.get("users", req.panelId),
      ctx.db.get("events", req.eventId),
    ]);
    const [guestProfile, speakerProfile] = await Promise.all([
      guest?.profileId ? ctx.db.get("profiles", guest.profileId) : null,
      speaker?.profileId ? ctx.db.get("profiles", speaker.profileId) : null,
    ]);
    if (!guestProfile || !speakerProfile || !speaker) return null;
    return {
      eventName: event?.name ?? "the event",
      guestName: guestProfile.name,
      guestHeadline: guestProfile.headline,
      note: req.note,
      speakerName: speakerProfile.name,
      speakerHeadline: speakerProfile.headline,
      talkTitle: speaker.talkTitle,
      sharedInterests: guestProfile.interests.filter((i) => speakerProfile.interests.includes(i)),
    };
  },
});

export const save = internalMutation({
  args: { requestId: v.id("chatRequests"), text: v.string(), source: v.union(v.literal("claude"), v.literal("template")) },
  returns: v.null(),
  handler: async (ctx, { requestId, text, source }) => {
    const req = await ctx.db.get("chatRequests", requestId);
    if (!req) return null;
    await ctx.db.patch("chatRequests", requestId, { followUp: { text, source, createdAt: Date.now() } });
    return null;
  },
});
