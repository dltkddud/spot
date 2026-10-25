import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const matchDirection = v.union(
  v.literal("they_can_help_you"),
  v.literal("you_can_help_them"),
  v.literal("both"),
);

// One AI match as shown to the person it was found for ("you"). otherId is "them".
export const matchSuggestion = v.object({
  otherId: v.id("users"),
  direction: matchDirection,
  pairSummary: v.string(),
  reasonForMe: v.string(),
  reasonForThem: v.string(),
  questionForMe: v.string(),
  questionForThem: v.string(),
  basedOn: v.array(v.string()),
});

export default defineSchema({
  events: defineTable({
    name: v.string(),
    venue: v.string(),
    endsAt: v.number(),
    // The endsAt value the end-of-event cleanup is currently scheduled for.
    cleanupScheduledFor: v.optional(v.number()),
    // Which mockData event this is (e.g. "calhacks-13"), so seed can find it again.
    key: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    // Set when the venue has a floor plan for the Map (see src/lib/floorplan.ts).
    floorPlan: v.optional(v.string()),
  }).index("by_key", ["key"]),

  zones: defineTable({
    eventId: v.id("events"),
    code: v.string(),
    name: v.string(),
    landmark: v.string(),
    order: v.number(),
    // Name of the zone's drawing in components/ZoneIcon.tsx.
    icon: v.optional(v.string()),
  }).index("by_event", ["eventId"]),

  // A person across every event: who they are and how to reach them.
  profiles: defineTable({
    name: v.string(),
    headline: v.string(),
    interests: v.array(v.string()),
    // Required for new profiles (see profiles.cleanLinkedin) and used to log in.
    // Optional only because older profiles were made without one.
    linkedinUrl: v.optional(v.string()),
    // Any other link (site, GitHub, email).
    contactUrl: v.optional(v.string()),
    // 6-character code friends type (or open as a link) to connect with me.
    connectCode: v.optional(v.string()),
    // false = never suggest huddles to me. Missing means yes.
    openToHuddles: v.optional(v.boolean()),
    // Old demo people only (e.g. "p-dana"); the remove-demo-people migration deletes them.
    seedKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_connect_code", ["connectCode"])
    .index("by_seed_key", ["seedKey"])
    .index("by_linkedin", ["linkedinUrl"]),

  // One person at one event. Chat requests and huddles point at these ids.
  users: defineTable({
    eventId: v.id("events"),
    // Always set once the profiles-and-events migration has run.
    profileId: v.optional(v.id("profiles")),
    role: v.union(v.literal("panel"), v.literal("attendee")),
    talkTitle: v.optional(v.string()),
    outfit: v.string(),
    zoneId: v.optional(v.id("zones")),
    status: v.union(
      v.literal("available"),
      v.literal("talking"),
      v.literal("leaving"),
    ),
    leavingAt: v.optional(v.number()),
    visible: v.boolean(),
    // Who sees my zone. visible stays true only for "everyone"; missing means
    // "everyone" if visible, otherwise "nobody".
    shareWith: v.optional(v.union(v.literal("everyone"), v.literal("connections"), v.literal("nobody"))),
    requestsPaused: v.boolean(),
    updatedAt: v.number(),
    // Someone tapped "Still here?" on my stale zone. Cleared once I confirm or update anything.
    stillHereAskedAt: v.optional(v.number()),
    // Old demo people only (e.g. "p-dana"); the remove-demo-people migration deletes them.
    seedKey: v.optional(v.string()),
    // Set when a speaker's leaving time came (or they tapped Leaving now): where
    // they were and who saw them, so admin.resetActivity can put them back.
    leftFrom: v.optional(
      v.object({
        zoneId: v.optional(v.id("zones")),
        shareWith: v.union(v.literal("everyone"), v.literal("connections"), v.literal("nobody")),
      }),
    ),
    // Optional, for AI matching: "What I want to learn today" / "What I can share". Max 140 chars.
    learnToday: v.optional(v.string()),
    canShare: v.optional(v.string()),

    // Moved to profiles by the profiles-and-events migration in seed.ts, which
    // also clears them. Delete these once both deployments have run it.
    name: v.optional(v.string()),
    headline: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
    contactUrl: v.optional(v.string()),
    connectCode: v.optional(v.string()),
    openToHuddles: v.optional(v.boolean()),
    // Removed feature ("Still here?"). Cleared by the remove-still-here-and-stay migration.
    locationCheckAt: v.optional(v.number()),
  })
    .index("by_event", ["eventId"])
    .index("by_event_role", ["eventId", "role"])
    .index("by_profile_and_event", ["profileId", "eventId"]),

  chatRequests: defineTable({
    eventId: v.id("events"),
    panelId: v.id("users"),
    attendeeId: v.id("users"),
    note: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("accepted"),
      v.literal("met"),
      v.literal("declined"),
      v.literal("missed"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
    // Set to the speaker's leavingAt once the 10-minute heads-up has gone out.
    leaveWarnedFor: v.optional(v.number()),
    // While part of a formed huddle: the huddle, and the earliest createdAt
    // among its members, which is where the whole huddle stands in line.
    huddleId: v.optional(v.id("huddles")),
    lineAt: v.optional(v.number()),
    // Why the guest never got their chat: the speaker left (or stopped being a
    // speaker), declined, or marked them missed. Each gets the speaker's LinkedIn.
    closedBecause: v.optional(v.union(v.literal("speaker_left"), v.literal("declined"), v.literal("missed"))),
    // The follow-up message drafted for the guest after that: by Claude, or the
    // fallback template when Claude isn't available.
    followUp: v.optional(
      v.object({
        text: v.string(),
        source: v.union(v.literal("claude"), v.literal("template")),
        createdAt: v.number(),
      }),
    ),
  })
    .index("by_panel_status", ["panelId", "status"])
    .index("by_attendee", ["attendeeId"])
    .index("by_event_and_status", ["eventId", "status"]),

  // Attendees waiting for the same speaker who share interests, meeting them together.
  huddles: defineTable({
    eventId: v.id("events"),
    panelId: v.id("users"),
    status: v.union(
      v.literal("suggested"), // Claude's idea, waiting for the speaker to send it (guests don't see it yet)
      v.literal("proposed"), // the speaker sent it; waiting for everyone to say yes
      v.literal("formed"), // everyone said yes; one place in line
      v.literal("met"),
      v.literal("declined"), // someone said "Not this time"
      v.literal("dissolved"), // a member left the line or the speaker left
    ),
    sharedInterests: v.array(v.string()),
    // Who grouped them: Claude (with a reason for the group and a question for
    // the speaker) or the shared-interest fallback. Missing means interests.
    source: v.optional(v.union(v.literal("claude"), v.literal("interests"))),
    reason: v.optional(v.string()),
    sharedQuestion: v.optional(v.string()),
    createdAt: v.number(),
    formedAt: v.optional(v.number()),
  }).index("by_panel_and_status", ["panelId", "status"]),

  // The last line composition Claude was asked to group for a speaker, so the
  // same line isn't sent twice.
  huddleChecks: defineTable({
    panelId: v.id("users"),
    key: v.string(),
    createdAt: v.number(),
  }).index("by_panel", ["panelId"]),

  huddleMembers: defineTable({
    huddleId: v.id("huddles"),
    userId: v.id("users"),
    requestId: v.id("chatRequests"),
    response: v.union(v.literal("pending"), v.literal("yes"), v.literal("no")),
    // From Claude: why this person is in the group, shown to them.
    whyYou: v.optional(v.string()),
    // Removed feature ("Stay connected?" after a huddle). Cleared by the
    // remove-still-here-and-stay migration in seed.ts; delete once both deployments have run it.
    stayAnswered: v.optional(v.array(v.id("users"))),
    stayYes: v.optional(v.array(v.id("users"))),
  })
    .index("by_huddle", ["huddleId"])
    .index("by_user", ["userId"])
    .index("by_request", ["requestId"]),

  // Profiles that agreed to share their zone with each other, at every event
  // they're both at. One row per direction.
  profileConnections: defineTable({
    profileId: v.id("profiles"),
    otherId: v.id("profiles"),
    source: v.union(v.literal("huddle"), v.literal("code"), v.literal("demo")),
    // Who made the connection, so only the other person gets a "connected with you" banner.
    by: v.optional(v.id("profiles")),
    createdAt: v.number(),
  }).index("by_profile_and_other", ["profileId", "otherId"]),

  // Old per-event connections. The profiles-and-events migration moves them to
  // profileConnections and empties this table; delete it after both deployments have run it.
  connections: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    otherId: v.id("users"),
    source: v.union(v.literal("huddle"), v.literal("code"), v.literal("demo")),
    by: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_user_and_other", ["userId", "otherId"]),

  // The AI matches last found for someone at an event, and the input they
  // came from (key), so the same input shows them again without asking Claude.
  matchSets: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    key: v.string(),
    source: v.union(v.literal("claude"), v.literal("interests")),
    items: v.array(matchSuggestion),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // A suggested 10-minute chat between two people at an event: proposed by one
  // from their AI matches, accepted by the other, then started and timed.
  matches: defineTable({
    eventId: v.id("events"),
    fromId: v.id("users"),
    toId: v.id("users"),
    status: v.union(
      v.literal("proposed"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("started"),
      v.literal("done"),
      v.literal("cancelled"),
    ),
    // The AI result, written from the sender's side: "you" is fromId, "them" is toId.
    direction: matchDirection,
    pairSummary: v.string(),
    reasonForFrom: v.string(),
    reasonForTo: v.string(),
    questionForFrom: v.string(),
    questionForTo: v.string(),
    basedOn: v.array(v.string()),
    source: v.union(v.literal("claude"), v.literal("interests"), v.literal("demo")),
    createdAt: v.number(),
    respondedAt: v.optional(v.number()),
    // Where to meet: the receiver's zone when they said yes (or the sender's).
    meetZoneId: v.optional(v.id("zones")),
    startedAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    // People who closed the "Time's up" card.
    wrappedUp: v.array(v.id("users")),
  })
    .index("by_from_and_status", ["fromId", "status"])
    .index("by_to_and_status", ["toId", "status"]),

  // One row per data migration that has run, so seed.ensure runs each only once.
  migrations: defineTable({
    name: v.string(),
    ranAt: v.number(),
  }).index("by_name", ["name"]),

  activity: defineTable({
    eventId: v.id("events"),
    type: v.union(
      v.literal("view_panel"),
      v.literal("request_chat"),
      v.literal("accept_request"),
      v.literal("mark_met"),
      v.literal("missed"),
      v.literal("click_recommendation"),
      v.literal("huddle_proposed"),
      v.literal("huddle_formed"),
      v.literal("connection_made"),
      v.literal("match_suggested"),
      v.literal("match_accepted"),
      v.literal("match_completed"),
    ),
    userId: v.id("users"),
    targetId: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_event_type", ["eventId", "type"]),
});
