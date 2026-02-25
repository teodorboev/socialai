---
name: onboarding-intelligence
description: "Runs during client onboarding. Analyzes existing social accounts (last 90 days), generates complete brand profile, identifies what works/doesn't, competitive position, and suggested first-month strategy. Turns 2-week manual onboarding into 10 minutes."
---

# SKILL: Onboarding Intelligence Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

When a new client connects their social accounts, this agent automatically analyzes their last 90 days of social media activity and produces a comprehensive brand intelligence report. Identifies strengths, weaknesses, competitive positioning, audience makeup, content performance patterns, and generates a recommended first-month strategy.

This is the "wow moment" that makes new clients feel the platform understood their business in minutes, not weeks.

---

## File Location

```
agents/onboarding-intelligence.ts
lib/ai/prompts/onboarding-intelligence.ts
lib/ai/schemas/onboarding-intelligence.ts
inngest/functions/onboarding-analysis.ts
```

---

## Trigger

```typescript
// Fires when a client connects their first social account
export const onboardingAnalysis = inngest.createFunction(
  { id: "onboarding-analysis" },
  { event: "account/connected" },
  async ({ event, step }) => {
    // Check: is this the org's first connected account?
    // If yes: run full onboarding analysis
    // If additional account: run incremental analysis for the new platform
  }
);
```

---

## Output Schema

```typescript
const OnboardingReportSchema = z.object({
  brandProfile: z.object({
    detectedBrandVoice: z.object({
      tone: z.array(z.string()).describe("'friendly', 'professional', 'casual', 'authoritative'"),
      vocabulary: z.string().describe("'simple and accessible' vs 'technical and specialized'"),
      emojiUsage: z.enum(["heavy", "moderate", "minimal", "none"]),
      hashtagStyle: z.string(),
      averageCaptionLength: z.number(),
      signaturePatterns: z.array(z.string())
        .describe("Recurring phrases, sign-offs, or stylistic quirks"),
    }),
    contentPillars: z.array(z.object({
      pillar: z.string(),
      frequency: z.string(),
      performance: z.enum(["strong", "average", "weak"]),
    })),
    visualStyle: z.object({
      dominantColors: z.array(z.string()),
      imageTypes: z.array(z.string()),
      consistency: z.enum(["highly_consistent", "somewhat_consistent", "inconsistent"]),
    }),
  }),

  performanceAudit: z.object({
    overallHealth: z.enum(["strong", "healthy", "needs_work", "struggling"]),
    platformBreakdown: z.record(z.string(), z.object({
      followers: z.number(),
      avgEngagementRate: z.number(),
      postFrequency: z.string(),
      bestContentType: z.string(),
      worstContentType: z.string(),
      bestPostingTimes: z.array(z.string()),
      growthTrend: z.enum(["growing", "stable", "declining"]),
    })),
    topPerformingPosts: z.array(z.object({
      platform: z.string(),
      caption: z.string().max(200),
      engagementRate: z.number(),
      whyItWorked: z.string(),
    })).max(5),
    underperformingPatterns: z.array(z.object({
      pattern: z.string(),
      frequency: z.string(),
      suggestion: z.string(),
    })),
  }),

  competitiveSnapshot: z.object({
    detectedCompetitors: z.array(z.object({
      name: z.string(),
      handle: z.string(),
      platform: z.string(),
      followers: z.number(),
      avgEngagement: z.number(),
    })),
    clientPosition: z.string()
      .describe("Where the client stands relative to competitors: 'leading', 'competitive', 'behind'"),
    quickWins: z.array(z.string())
      .describe("Things competitors do well that the client can start immediately"),
  }),

  audienceSnapshot: z.object({
    primaryDemographic: z.string(),
    peakActivityTimes: z.array(z.string()),
    interests: z.array(z.string()),
    engagementStyle: z.string(),
  }),

  recommendations: z.object({
    immediate: z.array(z.object({
      action: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      effort: z.enum(["quick_win", "moderate", "significant"]),
    })).describe("Things to start doing this week"),

    firstMonthStrategy: z.object({
      postsPerWeek: z.record(z.string(), z.number()),
      contentMix: z.record(z.string(), z.number()),
      primaryGoal: z.string(),
      keyThemes: z.array(z.string()),
      avoidList: z.array(z.string()),
    }),

    suggestedConfidenceSettings: z.object({
      autoPublishThreshold: z.number(),
      reasoning: z.string()
        .describe("Conservative for new clients, can relax after trust is built"),
    }),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Data Collection Phase (No LLM)

```typescript
async function collectOnboardingData(orgId: string, accounts: SocialAccount[]): Promise<RawOnboardingData> {
  const data: RawOnboardingData = {};

  for (const account of accounts) {
    const client = createSocialClient(account.platform, account);

    // Pull last 90 days of posts
    data[account.platform] = {
      posts: await client.getRecentPosts({ days: 90 }),
      metrics: await client.getAccountMetrics(),
      audience: await client.getAudienceDemographics?.(),
    };
  }

  // Detect competitors: look at who the brand follows + industry keywords
  data.potentialCompetitors = await detectCompetitors(orgId, accounts);

  return data;
}
```

---

## Database

```prisma
model OnboardingReport {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  brandProfile    Json
  performanceAudit Json
  competitiveSnapshot Json
  audienceSnapshot Json
  recommendations Json
  confidenceScore Float
  analyzedAt      DateTime @default(now())
  accountsAnalyzed String[]  // Which platforms were included
}
```

---

## Integration

```
Onboarding Intelligence Agent
├── brandProfile.detectedBrandVoice → BrandConfig (pre-fill brand voice settings)
├── performanceAudit.bestPostingTimes → PostingSchedule (pre-fill schedule)
├── competitiveSnapshot.detectedCompetitors → Competitor table (pre-populate)
├── audienceSnapshot → AudienceProfile (seed initial profile)
├── recommendations.firstMonthStrategy → Strategy Agent (use as first content plan)
├── recommendations.suggestedConfidenceSettings → OrgSettings (set conservative defaults)
└── Full report → Dashboard Onboarding page (display to client)
```

---

## Dashboard Presentation

After onboarding analysis completes, the dashboard shows a "Your Brand Intelligence Report" page:

1. **Brand Voice Summary**: "We detected your tone is friendly and casual, with moderate emoji use..."
2. **Performance Scorecard**: Platform-by-platform health check with letter grades
3. **Quick Wins**: "Start doing these 3 things this week for immediate impact"
4. **First Month Plan**: Auto-generated content calendar based on analysis
5. **"Approve & Start" button**: Activates the first month strategy, seeds the content pipeline

The client goes from "just connected my account" to "AI is managing my social media" in under 10 minutes.
