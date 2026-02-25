import { z } from "zod";

export const EngagementResponseSchema = z.object({
  response: z.string().max(500, "Response too long for social media reply"),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "URGENT"]),
  shouldRespond: z.boolean().describe("false = skip this (spam, trolling, emoji-only, doesn't warrant a reply)"),
  confidenceScore: z.number().min(0).max(1),
  category: z.enum([
    "appreciation",
    "question_faq",
    "question_unknown",
    "complaint",
    "support_request",
    "spam_troll",
    "conversation",
    "influencer_collab",
    "crisis",
  ]),
  suggestedAction: z.enum([
    "auto_respond",
    "queue_for_review",
    "escalate",
    "skip",
    "escalate_to_dm",
  ]),
  reasoning: z.string(),
});

export type EngagementResponse = z.infer<typeof EngagementResponseSchema>;
