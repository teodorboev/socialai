import { z } from "zod";

export const CaptionRewriterSchema = z.object({
  rewrittenCaption: z.string().describe("The rewritten caption optimized for better performance"),
  changes: z.array(z.object({
    type: z.string().describe("Type of change made (tone, length, hook, hashtags, etc.)"),
    original: z.string().describe("Original text segment"),
    rewritten: z.string().describe("New text segment"),
    rationale: z.string().describe("Why this change was made"),
  })).describe("Detailed list of changes made to the original caption"),
  expectedImprovement: z.object({
    metric: z.string().describe("Metric expected to improve (engagement, reach, clicks, etc.)"),
    percentage: z.number().describe("Expected percentage improvement"),
    rationale: z.string().describe("Reasoning behind the expected improvement"),
  }).describe("Expected performance improvements from the rewrite"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the rewrite quality"),
});

export type CaptionRewriter = z.infer<typeof CaptionRewriterSchema>;

export const CaptionRewriterInputSchema = z.object({
  organizationId: z.string(),
  originalCaption: z.string().describe("The original caption that underperformed"),
  platform: z.string().describe("Target platform (Instagram, TikTok, etc.)"),
  contentType: z.string().describe("Type of content (POST, REEL, STORY, CAROUSEL, etc.)"),
  issues: z.array(z.string()).describe("List of issues that caused underperformance"),
  targetMetrics: z.object({
    primaryGoal: z.string().describe("Primary goal (engagement, reach, conversions, etc.)"),
    currentMetrics: z.object({
      engagementRate: z.number().optional(),
      reach: z.number().optional(),
      clicks: z.number().optional(),
      impressions: z.number().optional(),
    }).optional(),
  }).describe("Target metrics to improve"),
  brandVoice: z.object({
    tone: z.array(z.string()),
    doNots: z.array(z.string()).optional(),
  }).optional().describe("Brand voice guidelines"),
  previousTopPerformers: z.array(z.object({
    caption: z.string(),
    metrics: z.record(z.string(), z.number()),
  })).optional().describe("Examples of well-performing content for reference"),
});

export type CaptionRewriterInput = z.infer<typeof CaptionRewriterInputSchema>;
