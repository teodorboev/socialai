---
name: community-builder
description: "Manages community growth beyond posting. Identifies super fans, suggests community initiatives (challenges, AMAs, polls), tracks community health metrics, automates rituals (weekly threads, milestones). Builds the tribe, not just follower count."
---

# SKILL: Community Builder Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Shifts focus from broadcasting content to building a community. Identifies and nurtures the client's most engaged followers ("super fans"), designs community initiatives that drive participation, tracks community health beyond vanity metrics, and automates recurring community rituals. The difference between a brand with followers and a brand with a tribe.

---

## File Location

```
agents/community-builder.ts
lib/ai/prompts/community-builder.ts
lib/ai/schemas/community-builder.ts
inngest/functions/community-management.ts
```

---

## Super Fan Identification

```typescript
interface SuperFanScore {
  handle: string;
  platform: Platform;
  metrics: {
    commentFrequency: number;      // Comments per month on brand posts
    commentQuality: number;        // Thoughtful vs generic (0-1)
    shareFrequency: number;        // How often they share brand content
    mentionFrequency: number;      // How often they mention the brand unprompted
    ugcCreated: number;            // User-generated content about the brand
    conversationDepth: number;     // Replies to brand replies (back-and-forth)
    tenureDays: number;            // How long they've been following/engaging
    positivityScore: number;       // Sentiment of their interactions (0-1)
  };
  tier: "super_fan" | "advocate" | "regular_engager" | "occasional" | "lurker";
  // super_fan: top 1%, advocate: top 5%, regular_engager: top 20%
  totalScore: number;
}
```

---

## Output Schema

```typescript
const CommunityReportSchema = z.object({
  communityHealth: z.object({
    overallScore: z.number().min(0).max(100),
    metrics: z.object({
      responseRate: z.number().describe("% of comments that are genuine responses not just emojis"),
      conversationDepth: z.number().describe("Avg reply chains per post"),
      memberToMemberInteractions: z.number().describe("Community members replying to each other"),
      returnEngagers: z.number().describe("% of engagers who engage >1x per week"),
      sentimentScore: z.number(),
      growthRate: z.number(),
    }),
    trend: z.enum(["thriving", "growing", "stable", "cooling", "declining"]),
  }),

  superFans: z.array(z.object({
    handle: z.string(),
    platform: z.string(),
    tier: z.string(),
    score: z.number(),
    notableActivity: z.string(),
    nurturingAction: z.object({
      action: z.enum([
        "thank_publicly",
        "feature_in_post",
        "send_dm_appreciation",
        "invite_to_beta",
        "send_gift",
        "offer_ambassador_role",
        "spotlight_their_ugc",
      ]),
      message: z.string().optional(),
      reasoning: z.string(),
    }),
  })).max(20),

  initiativeSuggestions: z.array(z.object({
    type: z.enum([
      "challenge",         // "Share your X using #BrandChallenge"
      "ama",               // Ask Me Anything session
      "poll",              // Community vote on something
      "user_spotlight",    // Feature a community member
      "weekly_thread",     // Recurring themed discussion
      "milestone_celebration", // Celebrate follower milestones
      "collaborative_content", // Community creates content together
      "exclusive_preview", // Give super fans early access
      "feedback_session",  // Ask community for input on something
    ]),
    title: z.string(),
    description: z.string(),
    platform: z.string(),
    estimatedEngagement: z.string(),
    draftContent: z.string().optional(),
    frequency: z.enum(["one_time", "weekly", "biweekly", "monthly"]),
  })),

  automatedRituals: z.array(z.object({
    ritual: z.string(),
    description: z.string(),
    schedule: z.string(),
    isActive: z.boolean(),
    lastTriggered: z.string().optional(),
    engagement: z.string().optional(),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Automated Community Rituals

| Ritual | Frequency | What It Does |
|--------|-----------|-------------|
| Weekly Thread | Weekly | Posts a themed discussion post (e.g., "Monday Motivation", "What are you working on?") |
| Follower Milestone | On milestone | Celebrates 1K, 5K, 10K, etc. with a thank-you post |
| Member Anniversary | Monthly batch | Acknowledges long-time followers with a mention |
| Super Fan Spotlight | Biweekly | Features a top community member in a post |
| Community Poll | Weekly | Posts an engaging poll relevant to the brand's niche |
| Welcome Wave | Daily batch | Likes/comments on new followers' recent posts |

---

## Database

```prisma
model CommunityMember {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  handle          String
  platform        Platform
  tier            String   @default("lurker")
  totalScore      Float    @default(0)
  commentCount    Int      @default(0)
  shareCount      Int      @default(0)
  mentionCount    Int      @default(0)
  firstEngagedAt  DateTime?
  lastEngagedAt   DateTime?
  nurturingActions String[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, handle, platform])
  @@index([organizationId, tier])
  @@index([organizationId, totalScore])
}

model CommunityRitual {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  type            String
  name            String
  description     String?
  schedule        String   // Cron expression
  platform        Platform
  templateContent String?  @db.Text
  isActive        Boolean  @default(true)
  lastTriggered   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## Schedule

```typescript
// Weekly: analyze community health + update super fan tiers
export const communityAnalysis = inngest.createFunction(
  { id: "community-analysis" },
  { cron: "0 6 * * 0" },  // Sunday 6am
  async ({ step }) => {
    // 1. Score all engagers from the past week
    // 2. Update tiers
    // 3. Generate nurturing actions for super fans
    // 4. Suggest new initiatives based on community mood
    // 5. Report community health
  }
);

// Ritual executor: runs every hour, checks if any rituals are due
export const ritualExecutor = inngest.createFunction(
  { id: "community-ritual-executor" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    // 1. Query active rituals where schedule matches current time
    // 2. Generate content for the ritual
    // 3. Route through content pipeline (Brand Voice → Compliance → Publish)
  }
);
```

---

## Integration

```
Community Builder Agent
├── superFans → UGC Curator (prioritize UGC from super fans)
├── superFans → Influencer Scout (super fans as nano-influencer candidates)
├── initiativeSuggestions → Strategy Agent (incorporate into content plan)
├── initiativeSuggestions → Content Creator (generate initiative content)
├── communityHealth → Reporting Narrator (include in reports)
├── communityHealth → Churn Prediction (healthy community = lower churn risk)
└── automatedRituals → Orchestrator (schedule ritual execution)
```
