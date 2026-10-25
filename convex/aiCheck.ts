"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const MODEL = "claude-haiku-5-5";

// Checks that Claude answers from this deployment. Never returns the key.
//   npx convex run aiCheck:ping          (Development)
//   npx convex run aiCheck:ping --prod   (Production)
export const ping = internalAction({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    model: v.string(),
    error: v.optional(v.object({ type: v.string(), message: v.string() })),
  }),
  handler: async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, model: MODEL, error: { type: "missing_key", message: "ANTHROPIC_API_KEY is not set." } };
    }
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 15_000, maxRetries: 0 });
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 256,
        output_config: { effort: "low" },
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (!text) return { ok: false, model: response.model, error: { type: response.stop_reason ?? "empty", message: "No text in the reply." } };
      return { ok: true, model: response.model };
    } catch (e) {
      const type =
        e instanceof Anthropic.AuthenticationError
          ? "invalid_key"
          : e instanceof Anthropic.NotFoundError
            ? "model_not_found"
            : e instanceof Anthropic.BadRequestError
              ? "bad_request"
              : e instanceof Anthropic.RateLimitError
                ? "rate_limited"
                : e instanceof Anthropic.APIError
                  ? `api_error_${e.status ?? "unknown"}`
                  : "network_or_sdk";
      const message = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
      return { ok: false, model: MODEL, error: { type, message } };
    }
  },
});
