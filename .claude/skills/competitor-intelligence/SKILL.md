---
name: competitor-intelligence
description: "Monitors competitor social accounts: posting frequency, content types, engagement rates, viral posts, follower growth. Identifies gaps and opportunities. Feeds Strategy and Content Creator agents."
---

# SKILL: Competitor Intelligence Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Continuously monitors competitor social media accounts to track what they're posting, what's working for them, and where they're weak. Produces actionable intelligence that feeds directly into the Strategy and Content Creator agents to give the client a competitive edge.

Runs daily for metric tracking, weekly for deep analysis reports.

---

## File Location

```
agents/competitor-intelligence.ts
lib/ai/prompts/competitor-intelligence.ts
lib/ai/schemas/competitor-intelligence.ts
inngest/functions/competitor-scan.ts
```

---

## Input Interface

```typescript
interface CompetitorIntelInput {
  organizationId: string;
  competitors: Array<{
    name: string;
    platforms: Array<{
      platform: Platform;
      handle: string;
      platformUserId?: string;
    }>;
  }>;
  brandConfig: {
    brandName: string;
    industry: string;
    contentThemes: string[];
    targetAudience: { demographics: string; interests: string[] };
  };
  previousReport?: {
    summary: string;
    date: string;
    keyFindings: string[];
  };
  clientMetrics: {         // Client's own metrics for comparison
    avgEngagementRate: Record<string, number>;  // per platform
    followerCounts: Record<string, number>;
    postFrequency: Record<string, number>;      // posts/week
  };
}
```

---

## Data Collection (No LLM — API calls)

```typescript
interface CompetitorSnapshot {
  competitorName: string;
  platform: Platform;
  handle: string;
  scannedAt: Date;
  metrics: {
    followers: number;
    followersChange7d: number;
    postsLast7d: number;
    avgEngagementRate: number;
    avgLikes: number;
    avgComments: number;
    avgShares: number;
  };
  recentPosts: Array<{
    platformPostId: string;
    caption: string;
    contentType: string;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
    postedAt: Date;
    url: string;
  }>;
  topPost: {
    caption: string;
    contentType: string;
    engagementRate: number;
    url: string;
    whyItWorked?: string;  // Filled by LLM analysis
  } | null;
}
```

Data source: Platform public APIs (no auth needed for public profiles on most platforms). Fallback: scraping via headless browser for platforms without public APIs.

---

## Output Schema (Analysis Mode)

```typescript
const CompetitorReportSchema = z.object({
  summary: z.string()
    .describe("2-3 sentence executive summary of competitive landscape this week"),
  competitors: z.array(z.object({
    name: z.string(),
    overallThreatLevel: z.enum(["low", "medium", "high"]),
    strengths: z.array(z.string()).max(3),
    weaknesses: z.array(z.string()).max(3),
    notableActivity: z.string()
      .describe("What they did this week that's worth noting"),
    topPerformingPost: z.object({
      platform: z.string(),
      description: z.string(),
      engagementRate: z.number(),
      whyItWorked: z.string(),
      canWeAdapt: z.boolean(),
      adaptationIdea: z.string().optional(),
    }).nullable(),
  })),
  gaps: z.array(z.object({
    gap: z.string()
      .describe("Something competitors aren't doing or doing poorly"),
    opportunity: z.string()
      .describe("How the client can exploit this gap"),
    platform: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    suggestedContentType: z.string(),
  })),
  contentInspirations: z.array(z.object({
    inspiration: z.string(),
    sourceCompetitor: z.string(),
    adaptedIdea: z.string()
      .describe("How to make this our own — NOT copy it"),
    platform: z.string(),
  })).max(5),
  benchmarks: z.object({
    clientVsAvgEngagement: z.number()
      .describe("Client engagement rate vs competitor average, as a percentage difference"),
    clientVsAvgPostFrequency: z.number(),
    clientVsAvgFollowerGrowth: z.number(),
  }),
  confidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are a competitive intelligence analyst for ${brandName} in the ${industry} industry.

You have data on ${competitors.length} competitors across social media platforms.
Your job is to:
1. Identify what competitors are doing well and why
2. Find gaps they're missing that ${brandName} can fill
3. Spot content ideas worth adapting (NOT copying)
4. Benchmark ${brandName}'s performance against the competitive set
5. Provide actionable recommendations

CRITICAL RULES:
- Never recommend copying content directly. Always adapt with the client's unique voice.
- Focus on patterns, not individual posts (unless a post went significantly viral).
- Compare like-for-like: same platform, similar follower counts where possible.
- Flag if a competitor is running paid promotion (unusually high engagement on specific posts).
- Be specific with numbers. "They're doing better" is useless. "Their Instagram Reels avg 4.2% engagement vs your 1.8%" is useful.
```

---

## Competitor Setup (Stored in DB)

```prisma
model Competitor {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name            String
  website         String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  accounts        CompetitorAccount[]
  snapshots       CompetitorSnapshot[]
}

model CompetitorAccount {
  id            String    @id @default(uuid())
  competitorId  String
  competitor    Competitor @relation(fields: [competitorId], references: [id], onDelete: Cascade)
  platform      Platform
  handle        String
  platformUserId String?
  createdAt     DateTime  @default(now())

  @@unique([competitorId, platform])
}

model CompetitorSnapshot {
  id              String   @id @default(uuid())
  competitorId    String
  competitor      Competitor @relation(fields: [competitorId], references: [id], onDelete: Cascade)
  platform        Platform
  followers       Int
  followersChange Int      @default(0)
  postsCount      Int
  avgEngagementRate Float
  topPostData     Json?
  recentPostsData Json?
  scannedAt       DateTime @default(now())
}
```

Admin UI: Dashboard → Settings → Competitors (add/remove competitor handles per platform).

---

## Schedule

```typescript
// Daily: collect competitor metrics
export const competitorScan = inngest.createFunction(
  { id: "competitor-scan", retries: 2 },
  { cron: "0 3 * * *" },  // 3am UTC daily
  async ({ step }) => { /* Fetch public data for all competitor accounts */ }
);

// Weekly: deep analysis report
export const competitorAnalysis = inngest.createFunction(
  { id: "competitor-analysis" },
  { cron: "0 8 * * 1" },  // Monday 8am
  async ({ step }) => { /* Run LLM analysis on accumulated snapshots */ }
);
```

---

## Integration

```
Competitor Intelligence Agent
├── gaps[] → Strategy Agent (incorporate gaps into next content plan)
├── contentInspirations[] → Content Creator Agent (as inspiration context)
├── benchmarks → Analytics Agent (include in weekly report)
└── topPerformingPost.adaptationIdea → Content Creator (queue as content suggestion)
```
