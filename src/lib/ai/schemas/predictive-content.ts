import { z } from "zod";

export const PredictiveContentSchema = z.object({
  predictions: z.array(z.object({
    contentId: z.string().optional(),
    contentPreview: z.string().describe("Brief preview of the content being evaluated"),
    predictedEngagementRate: z.number().describe("Predicted engagement rate as decimal (0.0-1.0)"),
    predictedImpressions: z.number().describe("Estimated impressions/reach"),
    predictedEngagements: z.number().describe("Estimated total engagements"),
    predictedClicks: z.number().describe("Estimated link clicks"),
    predictedConversions: z.number().describe("Estimated conversions/sales"),
    confidenceScore: z.number().describe("Confidence in this prediction (0.0-1.0)"),
    riskFactors: z.array(z.string()).describe("Factors that may negatively impact performance"),
    optimizationSuggestions: z.array(z.string()).describe("Suggestions to improve performance"),
  })),
  overallRecommendations: z.object({
    bestContentType: z.string().describe("Recommended content type for highest engagement"),
    bestPostingTime: z.string().describe("Recommended posting time"),
    bestPlatform: z.string().describe("Recommended platform for this content"),
    optimalHashtagCount: z.number().describe("Optimal number of hashtags"),
    contentThemes: z.array(z.string()).describe("Themes likely to perform well"),
  }),
  confidenceScore: z.number().min(0).max(1),
});

export type PredictiveContent = z.infer<typeof PredictiveContentSchema>;

export const PredictiveContentInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  contentOptions: z.array(z.object({
    contentId: z.string().optional(),
    caption: z.string(),
    hashtags: z.array(z.string()).optional(),
    mediaType: z.enum(["IMAGE", "VIDEO", "CAROUSEL", "TEXT"]).optional(),
    platform: z.string(),
    contentType: z.string(),
    scheduledTime: z.string().optional(),
  })),
  historicalData: z.object({
    topPerformingContent: z.array(z.object({
      caption: z.string(),
      platform: z.string(),
      engagementRate: z.number(),
      impressions: z.number(),
    })).optional(),
    averageEngagementRate: z.number().optional(),
    audienceDemographics: z.record(z.string(), z.any()).optional(),
  }).optional(),
  context: z.object({
    currentTrends: z.array(z.string()).optional(),
    competitorActivity: z.string().optional(),
    seasonalFactors: z.string().optional(),
  }).optional(),
});

export type PredictiveContentInput = z.infer<typeof PredictiveContentInputSchema>;
