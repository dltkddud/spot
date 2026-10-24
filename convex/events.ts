import { v } from "convex/values";
import { query } from "./_generated/server";
import schema from "./schema";

// The app assumes a single event.
export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      event: schema.doc("events"),
      zones: v.array(schema.doc("zones")),
    }),
  ),
  handler: async (ctx) => {
    const event = await ctx.db.query("events").first();
    if (!event) return null;
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .take(100);
    zones.sort((a, b) => a.order - b.order);
    return { event, zones };
  },
});
