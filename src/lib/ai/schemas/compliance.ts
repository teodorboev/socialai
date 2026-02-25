import { z } from "zod";

export const ComplianceResultSchema = z.object({
  passed: z.boolean(),
  overallRisk: z.enum(["clear", "low_risk", "medium_risk", "high_risk", "blocked"]),
  checks: z.array(z.object({
    category: z.enum([
      "ftc_disclosure",
      "health_claims",
      "financial_advice",
      "copyright",
      "platform_tos",
      "brand_guidelines",
      "competitor_mention",
      "profanity",
      "sensitive_topic",
      "misleading_claims",
      "data_privacy",
      "age_restricted",
      "accessibility",
      "legal_liability",
    ]),
    status: z.enum(["pass", "warn", "fail"]),
    detail: z.string().optional(),
    suggestedFix: z.string().optional(),
  })),
  requiredDisclosures: z.array(z.string()),
  suggestedRevision: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
});

export type ComplianceResult = z.infer<typeof ComplianceResultSchema>;

export interface ComplianceInput {
  organizationId: string;
  contentId: string;
  content: {
    caption: string;
    hashtags: string[];
    mediaPrompt?: string;
    altText?: string;
    linkUrl?: string;
    contentType: string;
    platform: string;
  };
  brandConfig: {
    brandName: string;
    industry: string;
    doNots: string[];
    regulatoryNotes?: string;
  };
  complianceRules?: Array<{
    category: string;
    rule: string;
    severity: string;
  }>;
}
