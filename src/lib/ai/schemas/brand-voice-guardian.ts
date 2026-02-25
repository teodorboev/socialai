import { z } from "zod";

export const BrandVoiceGuardianSchema = z.object({
  analysis: z.object({
    overallScore: z.number().min(0).max(1).describe("Overall brand voice consistency score"),
    toneConsistency: z.number().min(0).max(1).describe("Consistency of tone across content"),
    vocabularyFit: z.number().min(0).max(1).describe("Appropriateness of vocabulary"),
    messagingAlignment: z.number().min(0).max(1).describe("Alignment with brand messaging"),
    audienceAppropriateness: z.number().min(0).max(1).describe("Appropriateness for target audience"),
  }),
  violations: z.array(z.object({
    contentId: z.string().optional(),
    type: z.enum(["tone", "vocabulary", "messaging", "audience", "legal", "style"]),
    severity: z.enum(["minor", "moderate", "major"]),
    description: z.string(),
    suggestion: z.string(),
    quote: z.string().optional().describe("The problematic text snippet"),
  })),
  strengths: z.array(z.object({
    contentId: z.string().optional(),
    area: z.string(),
    description: z.string(),
  })),
  recommendations: z.array(z.object({
    priority: z.enum(["high", "medium", "low"]),
    action: z.string(),
    reason: z.string(),
  })),
  brandVoiceProfile: z.object({
    currentPerceivedTone: z.string().describe("How the brand voice is currently perceived"),
    gapAnalysis: z.string().describe("Gap between desired and actual voice"),
    improvementAreas: z.array(z.string()),
  }),
  confidenceScore: z.number().min(0).max(1),
});

export type BrandVoiceGuardian = z.infer<typeof BrandVoiceGuardianSchema>;

export const BrandVoiceGuardianInputSchema = z.object({
  organizationId: z.string(),
  brandName: z.string(),
  brandVoice: z.object({
    adjectives: z.array(z.string()),
    examples: z.array(z.string()),
    avoid: z.array(z.string()),
    mission: z.string().optional(),
    values: z.array(z.string()).optional(),
  }),
  contentToAnalyze: z.array(z.object({
    id: z.string().optional(),
    caption: z.string(),
    platform: z.string(),
    type: z.string(),
  })),
  targetAudience: z.record(z.string(), z.any()).optional(),
});

export type BrandVoiceGuardianInput = z.infer<typeof BrandVoiceGuardianInputSchema>;
