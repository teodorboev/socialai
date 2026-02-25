import { z } from "zod";

export const RoiAttributionSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  totalRevenue: z.number().describe("Total attributed revenue in the period"),
  socialMediaAttributedRevenue: z.number().describe("Revenue directly attributed to social media"),
  socialMediaAttributionPercentage: z.number().describe("Percentage of total revenue from social"),
  platformBreakdown: z.array(z.object({
    platform: z.string(),
    attributedRevenue: z.number(),
    percentageOfSocialRevenue: z.number(),
    customerAcquisitions: z.number(),
    averageOrderValue: z.number(),
  })),
  contentPerformance: z.array(z.object({
    contentId: z.string().optional(),
    type: z.string(),
    revenueAttributed: z.number(),
    conversions: z.number(),
    engagementScore: z.number(),
    roi: z.number().describe("Return on investment for this content"),
  })),
  customerJourneyAttribution: z.object({
    socialTouchpointCount: z.number().describe("Average number of social touchpoints before conversion"),
    highestConvertingTouchpoint: z.string(),
    conversionPathAnalysis: z.array(z.object({
      path: z.array(z.string()),
      conversions: z.number(),
      revenue: z.number(),
    })),
  }),
  recommendations: z.array(z.object({
    action: z.string(),
    expectedRoiIncrease: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type RoiAttribution = z.infer<typeof RoiAttributionSchema>;

export const RoiAttributionInputSchema = z.object({
  organizationId: z.string(),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  platforms: z.array(z.string()),
  revenueData: z.object({
    totalRevenue: z.number(),
    directAttributed: z.number().optional(),
    indirectAttributed: z.number().optional(),
  }).optional(),
  contentData: z.array(z.object({
    id: z.string(),
    platform: z.string(),
    type: z.string(),
    engagements: z.number(),
    clicks: z.number(),
    conversions: z.number().optional(),
    revenue: z.number().optional(),
  })).optional(),
});

export type RoiAttributionInput = z.infer<typeof RoiAttributionInputSchema>;
