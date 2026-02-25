import { z } from "zod";

export const PricingIntelligenceSchema = z.object({
  competitorPricing: z.array(z.object({
    competitor: z.string(),
    product: z.string(),
    price: z.number(),
    discount: z.number().optional(),
    promotions: z.array(z.string()),
  })),
  marketAnalysis: z.object({
    averagePrice: z.number(),
    priceRange: z.object({ min: z.number(), max: z.number() }),
    pricePositioning: z.enum(["budget", "mid_range", "premium", "luxury"]),
    demandLevel: z.enum(["very_low", "low", "moderate", "high", "very_high"]),
  }),
  pricingRecommendations: z.array(z.object({
    product: z.string(),
    currentPrice: z.number(),
    recommendedPrice: z.number(),
    expectedImpact: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  })),
  promotionalInsights: z.object({
    recommendedPromotions: z.array(z.object({
      type: z.string(),
      discount: z.number(),
      timing: z.string(),
      expectedUplift: z.string(),
    })),
    avoidRecommendations: z.array(z.string()),
  }),
  confidenceScore: z.number().min(0).max(1),
});

export type PricingIntelligence = z.infer<typeof PricingIntelligenceSchema>;

export const PricingIntelligenceInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    currentPrice: z.number(),
    cost: z.number().optional(),
  })),
  competitors: z.array(z.object({
    name: z.string(),
    products: z.array(z.object({
      name: z.string(),
      price: z.number(),
      discount: z.number().optional(),
    })),
  })).optional(),
  marketData: z.record(z.string(), z.any()).optional(),
});

export type PricingIntelligenceInput = z.infer<typeof PricingIntelligenceInputSchema>;
