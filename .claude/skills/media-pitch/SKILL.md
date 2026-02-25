---
name: media-pitch
description: "Identifies earned media opportunities from social traction. When content goes viral or topics gain momentum, drafts personalized pitches to relevant journalists. Maintains journalist database per industry. Bridges social and PR."
---

# SKILL: Media Pitch Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Identifies moments when social media traction creates earned media opportunities — when a post goes viral, when the brand's expertise aligns with a trending news story, or when a campaign generates noteworthy results. Drafts personalized pitches to relevant journalists and publications, maintaining a database of media contacts per industry. Bridges social media management and PR.

**ALWAYS escalates to human before sending any pitch.** This agent drafts — humans send.

---

## File Location

```
agents/media-pitch.ts
lib/ai/prompts/media-pitch.ts
lib/ai/schemas/media-pitch.ts
inngest/functions/media-opportunity-scan.ts
```

---

## Trigger Conditions

| Trigger | Source | Example |
|---------|--------|---------|
| Viral content | Analytics | Post hits top 1% engagement or >100K impressions |
| Trending alignment | Trend Scout | Brand's expertise matches a trending news story |
| Milestone | Analytics | Brand hits follower milestone, engagement record |
| Campaign success | ROI Attribution | Campaign drove measurable business results worth sharing |
| Industry moment | Social Listening | Brand mentioned in industry conversation |
| Data/research | Content Creator | Brand published original data or research |

---

## Output Schema

```typescript
const MediaPitchSchema = z.object({
  opportunity: z.object({
    type: z.enum(["viral_content", "trending_alignment", "milestone", "campaign_results", "industry_moment", "original_research"]),
    summary: z.string(),
    newsworthiness: z.number().min(0).max(1),
    timelinessWindow: z.string().describe("How long this opportunity is relevant"),
    socialProof: z.array(z.string()).describe("Metrics that make this newsworthy"),
  }),

  pitches: z.array(z.object({
    targetOutlet: z.string(),
    targetJournalist: z.string().optional(),
    journalistEmail: z.string().optional(),
    journalistBeat: z.string().optional(),
    recentCoverage: z.string().optional()
      .describe("What this journalist recently wrote that makes them a fit"),

    pitch: z.object({
      subjectLine: z.string(),
      body: z.string(),
      angle: z.string().describe("Why THIS journalist would care about THIS story"),
      hookType: z.enum(["data", "trend", "human_interest", "contrarian", "timely", "exclusive"]),
    }),

    attachments: z.array(z.string())
      .describe("What to include: press kit, images, data, quotes"),

    followUpPlan: z.object({
      followUpAfterDays: z.number(),
      followUpMessage: z.string(),
    }),
  })).max(5),

  pressReleaseDraft: z.string().optional()
    .describe("If the opportunity warrants a full press release"),

  socialAmplification: z.object({
    suggestedPosts: z.array(z.string())
      .describe("Social posts to publish alongside the PR push"),
    hashtagsForCoverage: z.array(z.string()),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model MediaContact {
  id              String   @id @default(uuid())
  organizationId  String?  // null = global contact
  name            String
  email           String?
  outlet          String
  beat            String   // "technology", "food", "lifestyle", "business", "local"
  platforms       Json?    // Their social handles for reference
  recentArticles  Json?    // Last 5 articles for context
  pitchedBefore   Boolean  @default(false)
  lastPitchedAt   DateTime?
  relationship    String   @default("cold") // "cold", "warm", "established"
  notes           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([beat])
  @@index([outlet])
}

model MediaPitch {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  opportunityType String
  targetOutlet    String
  targetJournalist String?
  subjectLine     String
  body            String   @db.Text
  status          String   @default("draft") // draft → approved → sent → responded → coverage_secured → no_response
  sentAt          DateTime?
  responseAt      DateTime?
  coverageUrl     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, status])
}
```

---

## Schedule

```typescript
// Event-driven: triggered when viral content or trending alignment detected
export const mediaPitchOpportunity = inngest.createFunction(
  { id: "media-pitch-opportunity" },
  { event: "media/opportunity-detected" },
  async ({ event, step }) => {
    // 1. Assess newsworthiness
    // 2. Match to relevant journalists from database
    // 3. Generate personalized pitches
    // 4. Escalate to human for approval
  }
);

// Weekly: scan for media contact database updates
export const mediaContactRefresh = inngest.createFunction(
  { id: "media-contact-refresh" },
  { cron: "0 5 * * 1" },
  async ({ step }) => {
    // Refresh recent articles for tracked journalists
    // Identify new journalists covering the client's industry
  }
);
```

---

## Rules

1. **NEVER auto-send pitches.** Always human-approved.
2. **Personalize every pitch.** Reference the journalist's recent work.
3. **Respect pitch etiquette.** Max 1 follow-up. Don't pitch the same story to competing outlets simultaneously without flagging it.
4. **Track outcomes.** Did the pitch result in coverage? Feed back for learning.
5. **Time-sensitive.** Flag urgency — trending alignment pitches lose value within 24-48 hours.
