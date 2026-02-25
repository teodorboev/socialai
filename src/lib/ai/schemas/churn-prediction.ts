import { z } from "zod";

export const ChurnPredictionSchema = z.object({
  churnRisk: z.object({
    score: z.number().min(0).max(1).describe("Churn probability score (0-1)"),
    level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]).describe("Churn risk level"),
    trend: z.enum(["INCREASING", "STABLE", "DECREASING"]).describe("Trend of churn risk"),
  }).describe("Overall churn risk assessment"),
  riskFactors: z.array(z.object({
    factor: z.string().describe("Description of the risk factor"),
    weight: z.number().min(0).max(1).describe("Weight/contribution to churn risk"),
    evidence: z.array(z.string()).describe("Data points supporting this factor"),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).describe("Severity of this factor"),
  })).describe("Identified risk factors contributing to churn probability"),
  retentionRecommendations: z.array(z.object({
    action: z.string().describe("Recommended retention action"),
    description: z.string().describe("Detailed description of the action"),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).describe("Priority level"),
    expectedImpact: z.string().describe("Expected impact on retention"),
    effort: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Effort required to implement"),
    timeline: z.string().describe("When to implement this action"),
    successMetrics: z.array(z.string()).describe("How to measure success"),
  })).describe("Actionable retention recommendations"),
  comparisonToSimilar: z.object({
    similarClientsRetained: z.number().describe("Similar clients successfully retained"),
    similarClientsChurned: z.number().describe("Similar clients that churned"),
    thisClientScore: z.number().describe("This client's risk score"),
    benchmarkScore: z.number().describe("Average risk score for similar clients"),
  }).describe("Comparison to similar clients"),
  earlyWarningSigns: z.array(z.object({
    sign: z.string().describe("Warning sign to monitor"),
    currentStatus: z.string().describe("Current status of this indicator"),
    threshold: z.string().describe("What would trigger concern"),
  })).describe("Early warning signs to monitor going forward"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the churn prediction"),
});

export type ChurnPrediction = z.infer<typeof ChurnPredictionSchema>;

export const ChurnPredictionInputSchema = z.object({
  organizationId: z.string(),
  usageData: z.object({
    last30Days: z.object({
      logins: z.number().describe("Number of logins in last 30 days"),
      featuresUsed: z.number().describe("Number of features used"),
      contentGenerated: z.number().describe("Content pieces generated"),
      postsPublished: z.number().describe("Posts published"),
      engagementActions: z.number().describe("Engagement actions taken"),
    }).describe("Usage in last 30 days"),
    last90Days: z.object({
      logins: z.number(),
      featuresUsed: z.number(),
      contentGenerated: z.number(),
      postsPublished: z.number(),
    }).optional().describe("Usage in last 90 days"),
    trend: z.enum(["INCREASING", "STABLE", "DECREASING"]).describe("Usage trend over time"),
    lastActiveDate: z.string().describe("Date of last platform activity"),
  }).describe("Platform usage data"),
  engagementMetrics: z.object({
    emailOpenRate: z.number().optional().describe("Recent email open rate"),
    reportViewRate: z.number().optional().describe("How often reports are viewed"),
    supportTickets: z.object({
      count: z.number(),
      sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).optional(),
      unresolvedCount: z.number().optional(),
    }).optional().describe("Support ticket history"),
    npsScore: z.number().optional().describe("Recent NPS score if available"),
  }).describe("Engagement with platform communications"),
  billingHistory: z.object({
    plan: z.string().describe("Current subscription plan"),
    monthsOnPlan: z.number().describe("How long on current plan"),
    planChanges: z.array(z.object({
      from: z.string(),
      to: z.string(),
      date: z.string(),
      direction: z.enum(["UPGRADE", "DOWNGRADE"]),
    })).describe("History of plan changes"),
    paymentIssues: z.array(z.object({
      date: z.string(),
      type: z.string(),
      resolved: z.boolean(),
    })).describe("Payment issues history"),
    outstandingBalance: z.number().optional().describe("Current outstanding balance"),
  }).describe("Billing and payment history"),
  accountData: z.object({
    teamSize: z.number().describe("Number of team members"),
    hasMultipleAdmins: z.boolean().describe("Whether there are multiple admins"),
    socialAccountsConnected: z.number().describe("Number of connected social accounts"),
    monthsAsCustomer: z.number().describe("Total months as customer"),
    onboardingCompleted: z.boolean().describe("Whether onboarding was completed"),
  }).describe("Account metadata"),
  comparableClients: z.array(z.object({
    outcome: z.enum(["RETAINED", "CHURNED"]),
    riskFactors: z.record(z.string(), z.number()),
    plan: z.string(),
    tenure: z.number(),
  })).optional().describe("Data on similar clients for benchmarking"),
});

export type ChurnPredictionInput = z.infer<typeof ChurnPredictionInputSchema>;
