---
name: influencer-scout
description: "Identifies potential influencer and micro-influencer partners. Scores on engagement authenticity, audience overlap, brand alignment. Detects fake followers. Generates outreach templates. Always escalates to human for final decision."
---

# SKILL: Influencer Scout Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Finds and evaluates potential influencer partners from two sources: the client's existing engaged audience (people already talking about the brand) and the broader niche (industry creators the brand should work with). Scores each candidate on authenticity, relevance, and reach. Generates personalized outreach messages. Always escalates to human — never auto-contacts influencers.

---

## File Location

```
agents/influencer-scout.ts
lib/ai/prompts/influencer-scout.ts
lib/ai/schemas/influencer-scout.ts
inngest/functions/influencer-scan.ts
```

---

## Output Schema

```typescript
const InfluencerReportSchema = z.object({
  candidates: z.array(z.object({
    name: z.string(),
    handle: z.string(),
    platform: z.string(),
    followers: z.number(),
    tier: z.enum(["nano", "micro", "mid", "macro", "mega"]),
    // nano: <10K, micro: 10-50K, mid: 50-250K, macro: 250K-1M, mega: >1M

    scores: z.object({
      authenticityScore: z.number().min(0).max(1)
        .describe("How real is their engagement? Detects bought followers, engagement pods"),
      relevanceScore: z.number().min(0).max(1)
        .describe("How aligned is their content with the brand's industry and audience?"),
      engagementQuality: z.number().min(0).max(1)
        .describe("Ratio of meaningful comments vs generic emoji/spam"),
      audienceOverlap: z.number().min(0).max(1)
        .describe("How much their audience overlaps with the brand's target demographic"),
      overallFit: z.number().min(0).max(1),
    }),

    metrics: z.object({
      avgEngagementRate: z.number(),
      avgLikes: z.number(),
      avgComments: z.number(),
      postFrequency: z.string(),
      topContentTypes: z.array(z.string()),
    }),

    redFlags: z.array(z.string())
      .describe("Bought followers, engagement pods, controversial history, competitor partnerships"),

    existingRelationship: z.enum(["none", "follows_brand", "engaged_with_brand", "mentioned_brand", "existing_customer"])
      .describe("Does this person already have a connection to the brand?"),

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
```

---

## Fake Follower Detection

```typescript
interface AuthenticitySignals {
  followerToFollowingRatio: number;     // Suspicious if >10:1 for small accounts
  engagementRate: number;                // Suspicious if <1% with >100K followers
  commentQuality: "genuine" | "generic" | "bot_like";
  followerGrowthPattern: "organic" | "spiky" | "purchased";
  audienceDemographics: "coherent" | "random";  // Real audiences cluster; fake ones are random
  postingConsistency: "consistent" | "erratic";
}

// Score: 0.0 = definitely fake, 1.0 = definitely authentic
function calculateAuthenticityScore(signals: AuthenticitySignals): number {
  // Weight each signal and compute composite score
  // Flag anyone below 0.5 as suspicious
}
```

---

## Database

```prisma
model InfluencerCandidate {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name            String
  handle          String
  platform        Platform
  followers       Int
  tier            String
  authenticityScore Float
  relevanceScore  Float
  overallFitScore Float
  metrics         Json
  redFlags        String[]
  relationship    String
  outreachStatus  String   @default("identified") // identified → approved → contacted → responded → partnered → rejected
  outreachMessage String?  @db.Text
  notes           String?  @db.Text
  scannedAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, handle, platform])
  @@index([organizationId, overallFitScore])
}
```

---

## Schedule & Rules

```typescript
export const influencerScan = inngest.createFunction(
  { id: "influencer-scan" },
  { cron: "0 5 * * 3" },  // Wednesday 5am weekly
  async ({ step }) => { /* Scan and score candidates */ }
);
```

**Critical rules:**
1. **ALWAYS escalate to human.** Never auto-contact influencers. This is a human decision.
2. **Never recommend influencers with authenticity score <0.5.** Flag them as suspicious.
3. **Check for competitor partnerships.** Flag anyone currently working with a direct competitor.
4. **Prioritize existing relationships.** Someone who already loves the brand is 10x more valuable.
5. **Budget awareness.** Nano/micro influencers for small budgets, larger tiers for larger budgets.

---

## Dashboard UI

Dashboard → Influencers:
- Pipeline view: Identified → Approved → Contacted → Responded → Partnered / Rejected
- Each candidate shows scores, metrics, red flags, and suggested outreach
- "Approve & Generate Outreach" button → moves to Contacted, copies message
- Filter by platform, tier, score, relationship status
