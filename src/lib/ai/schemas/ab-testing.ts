import { z } from "zod";

export const ExperimentDesignSchema = z.object({
  experimentId: z.string(),
  hypothesis: z.string()
    .describe("Clear hypothesis: 'Carousel posts will generate 2x more saves than single images'"),
  variable: z.string()
    .describe("What's being tested: content_type, caption_length, hashtag_count, posting_time, visual_style"),
  control: z.object({
    description: z.string(),
    parameters: z.record(z.string(), z.any()),
  }),
  variant: z.object({
    description: z.string(),
    parameters: z.record(z.string(), z.any()),
  }),
  successMetric: z.enum([
    "engagement_rate", "impressions", "reach", "saves",
    "shares", "clicks", "comments", "follower_growth"
  ]),
  sampleSize: z.number().min(5).max(50),
  durationDays: z.number().min(7).max(30),
  platform: z.string(),
  confidenceScore: z.number().min(0).max(1),
});

export type ExperimentDesign = z.infer<typeof ExperimentDesignSchema>;

export const ExperimentResultSchema = z.object({
  experimentId: z.string(),
  status: z.enum(["winner_control", "winner_variant", "inconclusive", "insufficient_data"]),
  controlMetric: z.number(),
  variantMetric: z.number(),
  improvement: z.number().describe("Percentage improvement of variant over control"),
  statisticalSignificance: z.number().describe("p-value"),
  isSignificant: z.boolean().describe("p < 0.05"),
  recommendation: z.string()
    .describe("What to do: adopt variant, keep control, run longer, test different variable"),
  playBookUpdate: z.string()
    .describe("Specific instruction to add to Content Creator's knowledge for this org"),
  confidenceScore: z.number().min(0).max(1),
});

export type ExperimentResult = z.infer<typeof ExperimentResultSchema>;

export interface ExperimentDesignInput {
  organizationId: string;
  platform: string;
  optimizationArea: string;
  existingPlaybook?: Array<{
    variable: string;
    finding: string;
    recommendation: string;
  }>;
  recentPerformance?: {
    contentType?: string;
    avgEngagementRate?: number;
  };
}

export interface ExperimentEvaluationInput {
  organizationId: string;
  experimentId: string;
  controlGroupId: string;
  variantGroupId: string;
  successMetric: string;
}
