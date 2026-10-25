import { v } from "convex/values";
import { mutation } from "./_generated/server";

// The server's clock, so every phone counts down leaving times from the same
// "now" the server scheduled them with (phone clocks can be off by minutes).
export const now = mutation({
  args: {},
  returns: v.number(),
  handler: async () => Date.now(),
});
