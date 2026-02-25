---
name: audience-intelligence
description: "Analyzes followers and engaged users to build dynamic audience personas. Identifies demographics, peak activity, content preferences, and engagement patterns. Feeds insights to Strategy, Content Creator, and Publisher."
---

# SKILL: Audience Intelligence Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Builds and maintains dynamic audience profiles by analyzing who actually engages with the client's content. Goes beyond basic demographics to understand behavior patterns, content preferences, peak activity windows, and audience evolution over time. Updates monthly as the audience shifts.

This is the "who are we actually talking to?" agent.

---

## File Location

```
agents/audience-intelligence.ts
lib/ai/prompts/audience-intelligence.ts
lib/ai/schemas/audience-intelligence.ts
inngest/functions/audience-analysis.ts
```

---

## Data Sources

| Data Point | Source |
|-----------|--------|
| Follower demographics (age, gender, location) | Platform APIs (IG Insights, FB Page Insights) |
| Active hours / peak engagement times | Derived from post-level timestamp + engagement data |
| Content type preferences | Analytics Agent data — which content types get most engagement |
| Top engaged users | Platform APIs — most frequent commenters, likers |
| Audience growth source | Platform APIs — where new followers come from |
| Interest signals | Derived from hashtags used, accounts followed, content engaged with |
| Engagement depth | Ratio of passive (likes) vs active (comments, shares, saves) |

---

## Output Schema

```typescript
const AudienceReportSchema = z.object({
  personas: z.array(z.object({
    name: z.string().describe("Memorable persona name: 'Busy Mom Maria', 'Startup Steve'"),
    percentage: z.number().describe("Estimated % of audience this persona represents"),
    demographics: z.object({
      ageRange: z.string(),
      gender: z.string(),
      topLocations: z.array(z.string()).max(5),
      language: z.string(),
    }),
    behavior: z.object({
      peakActivityDays: z.array(z.string()),
      peakActivityHours: z.array(z.string()),
      preferredContentTypes: z.array(z.string()),
      engagementStyle: z.enum(["passive_scroller", "active_engager", "sharer_amplifier", "creator_ugc"]),
      averageSessionContext: z.string().describe("When/why they're on the platform: 'morning commute', 'lunch break', 'evening wind-down'"),
    }),
    interests: z.array(z.string()),
    painPoints: z.array(z.string()),
    contentThatResonates: z.array(z.string())
      .describe("Specific content themes, formats, and tones this persona responds to"),
    contentToAvoid: z.array(z.string())
      .describe("What turns this persona off or causes unfollows"),
  })).min(2).max(5),

  platformBreakdown: z.record(z.string(), z.object({
    dominantPersona: z.string(),
    audienceSize: z.number(),
    growthRate: z.number(),
    engagementQuality: z.enum(["high", "medium", "low"]),
    uniqueTraits: z.string().describe("What's different about the audience on THIS platform"),
  })),

  optimalPostingWindows: z.record(z.string(), z.array(z.object({
    day: z.string(),
    startHour: z.number(),
    endHour: z.number(),
    timezone: z.string(),
    reasoning: z.string(),
  }))),

  audienceShifts: z.array(z.object({
    shift: z.string(),
    direction: z.enum(["growing", "shrinking", "emerging"]),
    implication: z.string(),
    recommendation: z.string(),
  })),

  contentRecommendations: z.array(z.object({
    targetPersona: z.string(),
    recommendation: z.string(),
    platform: z.string(),
    expectedImpact: z.string(),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Schedule

```typescript
// Weekly: light audience metrics refresh
export const audienceMetricsRefresh = inngest.createFunction(
  { id: "audience-metrics-refresh" },
  { cron: "0 4 * * 0" },  // Sunday 4am
  async ({ step }) => {
    // Pull latest demographic data from platform APIs
    // Update stored audience metrics
    // No LLM call — pure data collection
  }
);

// Monthly: full persona analysis
export const audienceDeepAnalysis = inngest.createFunction(
  { id: "audience-deep-analysis" },
  { cron: "0 6 15 * *" },  // 15th of each month
  async ({ step }) => {
    // 1. Gather 30 days of engagement data
    // 2. Pull demographic data from all platforms
    // 3. Analyze content performance by audience segment
    // 4. Run LLM to build/update personas
    // 5. Store report and update org's audience profile
    // 6. Feed results to Strategy Agent for next month's plan
  }
);
```

---

## Integration

```
Audience Intelligence Agent
├── personas → Strategy Agent (tailor content plan to actual audience)
├── optimalPostingWindows → Publisher Agent (override default posting times)
├── contentRecommendations → Content Creator Agent (as persona context)
├── platformBreakdown → Analytics Agent (include in reports)
└── audienceShifts → Orchestrator (trigger strategy refresh if major shift detected)
```

---

## Database

```prisma
model AudienceProfile {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  personas        Json     // Full personas array from the output
  platformBreakdown Json
  optimalWindows  Json
  audienceShifts  Json?
  analyzedAt      DateTime @default(now())
  periodStart     DateTime
  periodEnd       DateTime

  @@index([organizationId, analyzedAt])
}
```
