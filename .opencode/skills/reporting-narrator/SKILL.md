---
name: reporting-narrator
description: "Takes raw analytics data and writes client-ready narrative reports. Not just charts — actual explanations of what happened, why, and what to do next. Replaces hours of analyst time per client per week."
---

# SKILL: Reporting Narrator Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Transforms raw analytics data into polished, client-ready narrative reports that tell the story behind the numbers. Explains what happened, why it happened, and what the client should expect or do next. Supports multiple output formats: executive summary emails, detailed PDF reports, and dashboard narrative panels.

For managed service clients, this replaces the analyst who manually writes weekly performance summaries. For SaaS clients, it adds the "insight layer" that makes data actionable.

---

## File Location

```
agents/reporting-narrator.ts
lib/ai/prompts/reporting-narrator.ts
lib/ai/schemas/reporting-narrator.ts
inngest/functions/narrative-report.ts
```

---

## Report Types

| Type | Audience | Frequency | Format |
|------|----------|-----------|--------|
| Weekly Performance | Client / Org Admin | Weekly | Email + Dashboard |
| Monthly Deep Dive | Client / Org Admin | Monthly | PDF + Email |
| Executive Summary | Client C-suite | Monthly | Email (3 paragraphs max) |
| Campaign Report | Client marketing team | End of campaign | PDF |
| Quarterly Business Review | Managed service clients | Quarterly | PDF presentation |

---

## Output Schema

```typescript
const NarrativeReportSchema = z.object({
  reportType: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),

  executiveSummary: z.string()
    .describe("2-3 sentences: headline result, key win, and one thing to watch"),

  sections: z.array(z.object({
    title: z.string(),
    narrative: z.string()
      .describe("Written in natural language, not bullet points. Explains the data like a human analyst would in a meeting."),
    keyMetrics: z.array(z.object({
      metric: z.string(),
      value: z.string(),
      change: z.string(),
      changeDirection: z.enum(["up", "down", "flat"]),
      significance: z.string(),
    })),
    insight: z.string()
      .describe("The 'so what' — why this matters and what it means"),
  })),

  wins: z.array(z.object({
    win: z.string(),
    evidence: z.string(),
    recommendation: z.string().describe("How to replicate or build on this win"),
  })),

  concerns: z.array(z.object({
    concern: z.string(),
    evidence: z.string(),
    suggestedAction: z.string(),
    urgency: z.enum(["monitor", "action_needed", "urgent"]),
  })),

  nextPeriodOutlook: z.object({
    forecast: z.string(),
    plannedActions: z.array(z.string()),
    keyDates: z.array(z.string()),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are a senior social media analyst writing a performance report for ${brandName}.

Your audience is ${reportAudience}. They are ${audienceContext}.

Write in NATURAL LANGUAGE as if you were presenting in a meeting. 
Not bullet points. Not data dumps. Tell the STORY of what happened.

RULES:
1. Lead with the headline: What's the single most important thing to know?
2. Always compare to previous period: "up 12% from last week" not just "engagement was 4.2%"
3. Explain WHY, not just WHAT: "Engagement dropped because we posted 3 fewer Reels" not just "Engagement dropped"
4. Every concern must have a suggested action. Don't just flag problems — propose solutions.
5. Celebrate wins genuinely. Clients need to see ROI to stay.
6. Use specific numbers, not vague language: "327 new followers" not "significant follower growth"
7. For executive audiences: keep it to 3 paragraphs max. They don't read long reports.
8. End with a forward-looking statement so the client knows what's coming next.

TONE:
- Professional but warm
- Confident but not arrogant
- Honest about underperformance (don't hide bad news)
- Optimistic about what's ahead
```

---

## Input Data Sources

```typescript
interface ReportInput {
  organizationId: string;
  reportType: string;
  period: { start: Date; end: Date };
  analyticsData: {
    platformMetrics: Record<string, PlatformMetrics>;
    topPosts: ContentPerformance[];
    bottomPosts: ContentPerformance[];
    audienceGrowth: AudienceGrowthData;
    engagementTrends: TimeSeriesData[];
    contentMix: ContentMixData;
  };
  previousPeriodData: typeof analyticsData;  // For comparison
  competitorData?: CompetitorBenchmark[];     // From Competitor Intelligence
  audienceProfile?: AudienceProfile;          // From Audience Intelligence
  activeExperiments?: ExperimentResult[];     // From A/B Testing
  strategyPlan?: StrategyPlan;                // From Strategy Agent — for alignment check
}
```

---

## Database

```prisma
model NarrativeReport {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  reportType      String
  periodStart     DateTime
  periodEnd       DateTime
  executiveSummary String   @db.Text
  fullReport      Json     // Complete NarrativeReportSchema output
  pdfUrl          String?  // Supabase Storage URL for PDF version
  emailSentAt     DateTime?
  emailRecipients String[]
  createdAt       DateTime @default(now())

  @@index([organizationId, reportType, periodStart])
}
```

---

## Schedule

```typescript
// Weekly: generate weekly performance narratives
export const weeklyNarrative = inngest.createFunction(
  { id: "weekly-narrative-report" },
  { cron: "0 8 * * 1" },  // Monday 8am
  async ({ step }) => {
    // 1. For each org with weeklyReportEnabled
    // 2. Gather analytics data for last 7 days
    // 3. Gather previous week for comparison
    // 4. Gather competitor data, audience data, experiment results
    // 5. Run ReportingNarratorAgent
    // 6. Generate PDF if configured
    // 7. Send email to org admin(s)
    // 8. Store report
  }
);

// Monthly: deep dive report
export const monthlyNarrative = inngest.createFunction(
  { id: "monthly-narrative-report" },
  { cron: "0 9 1 * *" },  // 1st of month
  async ({ step }) => { /* Same flow, monthly data, richer analysis */ }
);
```

---

## PDF Generation

```typescript
// Use a headless PDF generator (puppeteer, @react-pdf/renderer, or html-pdf)
// Template stored in DB (EmailTemplate pattern — but for PDF)
// Brand the PDF with client's colors and logo
async function generateReportPDF(report: NarrativeReport, brandConfig: BrandConfig): Promise<string> {
  // 1. Render report to HTML using stored template
  // 2. Convert to PDF
  // 3. Upload to Supabase Storage: /{orgId}/reports/{reportType}/{period}.pdf
  // 4. Return storage URL
}
```
