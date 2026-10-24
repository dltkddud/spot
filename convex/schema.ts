import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  events: defineTable({
    name: v.string(),
    venue: v.string(),
    endsAt: v.number(),
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
  })
    .index("by_event", ["eventId"])
    .index("by_event_role", ["eventId", "role"]),

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
  })
    .index("by_panel_status", ["panelId", "status"])
    .index("by_attendee", ["attendeeId"]),

  activity: defineTable({
    eventId: v.id("events"),
    type: v.union(
      v.literal("view_panel"),
      v.literal("request_chat"),
      v.literal("accept_request"),
      v.literal("mark_met"),
      v.literal("missed"),
      v.literal("click_recommendation"),
    ),
    userId: v.id("users"),
    targetId: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_event_type", ["eventId", "type"]),
});
