import { z } from "zod";

export const HashtagOptimizerSchema = z.object({
  optimizedHashtags: z.array(z.object({
    tag: z.string(),
    relevance: z.number().min(0).max(1),
    volume: z.number().optional().describe("Estimated usage volume"),
    competition: z.enum(["low", "medium", "high"]),
    trending: z.boolean().optional(),
  })),
  mix: z.object({
    highVolume: z.array(z.string()).describe("High volume, competitive"),
    mediumVolume: z.array(z.string()).describe("Medium volume"),
    niche: z.array(z.string()).describe("Low volume, specific"),
    branded: z.array(z.string()).describe("Brand-specific"),
  }),
  recommendations: z.array(z.object({
    platform: z.string(),
    optimalCount: z.number(),
    mix: z.string(),
    reasoning: z.string(),
  })),
  avoid: z.array(z.object({
    tag: z.string(),
    reason: z.string(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type HashtagOptimizer = z.infer<typeof HashtagOptimizerSchema>;

export const HashtagOptimizerInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  content: z.string().describe("Caption or content to optimize hashtags for"),
  platform: z.string(),
  targetAudience: z.record(z.string(), z.any()).optional(),
  industry: z.string(),
  competitorHashtags: z.array(z.string()).optional(),
  currentHashtags: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
});

export type HashtagOptimizerInput = z.infer<typeof HashtagOptimizerInputSchema>;
