import { z } from "zod";

export const InfluencerReportSchema = z.object({
  candidates: z.array(z.object({
    name: z.string(),
    handle: z.string(),
    platform: z.string(),
    followers: z.number(),
    tier: z.enum(["nano", "micro", "mid", "macro", "mega"]),
    scores: z.object({
      authenticityScore: z.number().min(0).max(1),
      relevanceScore: z.number().min(0).max(1),
      engagementQuality: z.number().min(0).max(1),
      audienceOverlap: z.number().min(0).max(1),
      overallFit: z.number().min(0).max(1),
    }),
    metrics: z.object({
      avgEngagementRate: z.number(),
      avgLikes: z.number(),
      avgComments: z.number(),
      postFrequency: z.string(),
      topContentTypes: z.array(z.string()),
    }),
    redFlags: z.array(z.string()),
    existingRelationship: z.enum(["none", "follows_brand", "engaged_with_brand", "mentioned_brand", "existing_customer"]),
    outreachSuggestion: z.object({
      approach: z.enum(["dm", "email", "comment_first", "send_product"]),
      message: z.string(),
      reasoning: z.string(),
    }),
  })),
  summary: z.object({
    totalScanned: z.number(),
    qualifiedCandidates: z.number(),
    topRecommendation: z.string(),
    estimatedBudgetRange: z.string(),
    suggestedCampaignType: z.string(),
  }),
  confidenceScore: z.number().min(0).max(1),
});

export type InfluencerReport = z.infer<typeof InfluencerReportSchema>;

export interface InfluencerScoutInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    industry: string;
    targetAudience: { demographics: string; interests: string[] };
  };
  candidateData: Array<{
    name: string;
    handle: string;
    platform: string;
    followers: number;
    avgEngagementRate: number;
    avgLikes: number;
    avgComments: number;
    postFrequency: string;
    topContentTypes: string[];
    recentPosts?: Array<{ caption: string; likes: number; comments: number }>;
  }>;
  budget?: string;
}
