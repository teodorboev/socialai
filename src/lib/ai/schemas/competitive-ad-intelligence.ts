import { z } from "zod";

export const CompetitiveAdIntelligenceSchema = z.object({
  competitorAds: z.array(z.object({
    competitor: z.string(),
    platform: z.string(),
    adType: z.enum(["image", "video", "carousel", "collection", "story"]),
    headline: z.string(),
    description: z.string(),
    cta: z.string(),
    targeting: z.string().optional(),
    estimatedSpend: z.number().optional(),
    performance: z.object({
      relevance: z.number().min(0).max(10),
      engagement: z.number().optional(),
    }).optional(),
  })),
  themes: z.array(z.object({
    theme: z.string(),
    frequency: z.number(),
    competitors: z.array(z.string()),
  })),
  creativeAnalysis: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    trends: z.array(z.string()),
  }),
  opportunities: z.array(z.object({
    gap: z.string(),
    recommendation: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })),
  adCopyRecommendations: z.array(z.object({
    angle: z.string(),
    headline: z.string(),
    description: z.string(),
    cta: z.string(),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type CompetitiveAdIntelligence = z.infer<typeof CompetitiveAdIntelligenceSchema>;

export const CompetitiveAdIntelligenceInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  industry: z.string(),
  competitors: z.array(z.string()),
  platforms: z.array(z.string()).optional(),
  adLibraryData: z.array(z.any()).optional(),
});

export type CompetitiveAdIntelligenceInput = z.infer<typeof CompetitiveAdIntelligenceInputSchema>;
