import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

type ActivityType = Doc<"activity">["type"];

const TYPES = schema.tables.activity.validator.fields.type.members.map((m) => m.value);

// Server-side record of something worth counting (huddles, connections, ...).
export async function record(
  ctx: MutationCtx,
  eventId: Id<"events">,
  type: ActivityType,
  userId: Id<"users">,
  targetId?: Id<"users">,
) {
  await ctx.db.insert("activity", { eventId, type, userId, targetId, createdAt: Date.now() });
}

// Event-wide counts per activity type. Bounded per type; fine at hackathon scale.
export const summary = query({
  args: { eventId: v.id("events") },
  returns: v.record(v.string(), v.number()),
  handler: async (ctx, { eventId }) => {
    const counts: Record<string, number> = {};
    for (const type of TYPES) {
      const rows = await ctx.db
        .query("activity")
        .withIndex("by_event_type", (q) => q.eq("eventId", eventId).eq("type", type))
        .take(5000);
      counts[type] = rows.length;
    }
    return counts;
  },
});
