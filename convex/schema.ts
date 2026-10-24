import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  events: defineTable({
    name: v.string(),
    venue: v.string(),
    endsAt: v.number(),
    // The endsAt value the end-of-event cleanup is currently scheduled for.
    cleanupScheduledFor: v.optional(v.number()),
  }),

  zones: defineTable({
    eventId: v.id("events"),
    code: v.string(),
    name: v.string(),
    landmark: v.string(),
    order: v.number(),
  }).index("by_event", ["eventId"]),

  users: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    role: v.union(v.literal("panel"), v.literal("attendee")),
    headline: v.string(),
    talkTitle: v.optional(v.string()),
    interests: v.array(v.string()),
    outfit: v.string(),
    contactUrl: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    status: v.union(
      v.literal("available"),
      v.literal("talking"),
      v.literal("leaving"),
    ),
    leavingAt: v.optional(v.number()),
    visible: v.boolean(),
    requestsPaused: v.boolean(),
    updatedAt: v.number(),
    // Demo people created by seed keep their mockData id here (e.g. "p-dana").
    seedKey: v.optional(v.string()),
    // Someone asked "Still here?" at this time and it hasn't been answered yet.
    locationCheckAt: v.optional(v.number()),
    // false = never suggest huddles to me. Missing means yes.
    openToHuddles: v.optional(v.boolean()),
    // Who sees my zone. visible stays true only for "everyone"; missing means
    // "everyone" if visible, otherwise "nobody".
    shareWith: v.optional(v.union(v.literal("everyone"), v.literal("connections"), v.literal("nobody"))),
    // 6-character code friends type (or open as a link) to connect with me.
    connectCode: v.optional(v.string()),
  })
    .index("by_event", ["eventId"])
    .index("by_event_role", ["eventId", "role"])
    .index("by_connect_code", ["connectCode"]),

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
  })
    .index("by_panel_status", ["panelId", "status"])
    .index("by_attendee", ["attendeeId"])
    .index("by_event_and_status", ["eventId", "status"]),

  // Attendees waiting for the same speaker who share interests, meeting them together.
  huddles: defineTable({
    eventId: v.id("events"),
    panelId: v.id("users"),
    status: v.union(
      v.literal("proposed"), // waiting for everyone to say yes
      v.literal("formed"), // everyone said yes; one place in line
      v.literal("met"),
      v.literal("declined"), // someone said "Not this time"
      v.literal("dissolved"), // a member left the line or the speaker left
    ),
    sharedInterests: v.array(v.string()),
    createdAt: v.number(),
    formedAt: v.optional(v.number()),
  }).index("by_panel_and_status", ["panelId", "status"]),

  huddleMembers: defineTable({
    huddleId: v.id("huddles"),
    userId: v.id("users"),
    requestId: v.id("chatRequests"),
    response: v.union(v.literal("pending"), v.literal("yes"), v.literal("no")),
    // After meeting: other members this person answered "Stay connected?" for, and said yes to.
    stayAnswered: v.array(v.id("users")),
    stayYes: v.array(v.id("users")),
  })
    .index("by_huddle", ["huddleId"])
    .index("by_user", ["userId"])
    .index("by_request", ["requestId"]),

  // People who agreed to share their zone with each other. One row per direction.
  connections: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    otherId: v.id("users"),
    source: v.union(v.literal("huddle"), v.literal("code"), v.literal("demo")),
    // Who made the connection, so only the other person gets a "connected with you" banner.
    by: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_user_and_other", ["userId", "otherId"]),

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
    ),
    userId: v.id("users"),
    targetId: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_event_type", ["eventId", "type"]),
});
