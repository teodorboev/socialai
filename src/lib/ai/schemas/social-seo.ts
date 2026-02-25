import { z } from "zod";

export const SocialSeoSchema = z.object({
  keywordAnalysis: z.array(z.object({
    keyword: z.string(),
    searchVolume: z.number().optional(),
    difficulty: z.number().min(0).max(100).optional(),
    relevance: z.number().min(0).max(1),
    competition: z.enum(["low", "medium", "high"]),
    opportunity: z.enum(["low", "medium", "high"]),
  })),
  contentRecommendations: z.array(z.object({
    contentId: z.string().optional(),
    currentKeywordDensity: z.number().optional(),
    recommendedKeywords: z.array(z.string()),
    suggestedChanges: z.array(z.string()),
    expectedSeoImpact: z.string(),
  })),
  hashtagStrategy: z.object({
    primaryHashtags: z.array(z.object({
      tag: z.string(),
      volume: z.number().optional(),
      relevance: z.number().min(0).max(1),
    })),
    secondaryHashtags: z.array(z.string()),
    brandedHashtags: z.array(z.string()),
    trendingHashtags: z.array(z.string()).optional(),
  }),
  profileOptimization: z.object({
    bioScore: z.number().min(0).max(1),
    bioSuggestions: z.array(z.string()),
    keywordOpportunities: z.array(z.string()),
  }),
  overallSeoScore: z.number().min(0).max(1),
  quickWins: z.array(z.object({
    action: z.string(),
    effort: z.enum(["low", "medium", "high"]),
    impact: z.enum(["low", "medium", "high"]),
  })),
  confidenceScore: z.number().min(0).max(1),
});

export type SocialSeo = z.infer<typeof SocialSeoSchema>;

export const SocialSeoInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  industry: z.string(),
  targetKeywords: z.array(z.string()),
  contentToOptimize: z.array(z.object({
    id: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    platform: z.string(),
  })).optional(),
  currentBio: z.string().optional(),
  competitors: z.array(z.string()).optional(),
});

export type SocialSeoInput = z.infer<typeof SocialSeoInputSchema>;
