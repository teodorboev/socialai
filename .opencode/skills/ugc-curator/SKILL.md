---
name: ugc-curator
description: "Finds user-generated content about the brand, requests permission via templated DM, queues approved UGC for resharing. UGC gets 4x higher engagement than branded content — this automates the entire pipeline."
---

# SKILL: UGC Curator Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Discovers user-generated content featuring or mentioning the brand, evaluates quality and brand-safety, sends permission requests via templated DMs, and queues approved UGC for resharing. Automates what is typically a manual, time-consuming process that most brands neglect despite UGC consistently outperforming branded content.

---

## File Location

```
agents/ugc-curator.ts
lib/ai/prompts/ugc-curator.ts
lib/ai/schemas/ugc-curator.ts
inngest/functions/ugc-pipeline.ts
```

---

## Pipeline

```
DISCOVER → EVALUATE → REQUEST PERMISSION → TRACK RESPONSE → QUEUE FOR RESHARE
    ↓          ↓              ↓                   ↓                 ↓
 Social    Quality +      Templated DM        Auto-detect       Create content
 Listening  brand-safe?   via Engagement      "yes"/"no"        record with
 + tags     LLM check     Agent channel       in reply           credit
```

---

## Discovery Sources

| Source | How |
|--------|-----|
| Tagged posts | Platform API — posts tagging the brand account |
| Brand hashtag | Posts using branded hashtags |
| Brand mentions | Social Listening Agent — untagged mentions with media |
| Location tags | Posts at the brand's physical locations |
| Review sites | Photos attached to positive reviews |

---

## Output Schema

```typescript
const UGCEvaluationSchema = z.object({
  candidates: z.array(z.object({
    sourceUrl: z.string(),
    platform: z.string(),
    authorHandle: z.string(),
    authorFollowers: z.number(),
    contentType: z.enum(["photo", "video", "carousel", "story", "reel", "text"]),
    originalCaption: z.string(),

    evaluation: z.object({
      qualityScore: z.number().min(0).max(1)
        .describe("Visual/content quality: lighting, composition, clarity"),
      brandAlignmentScore: z.number().min(0).max(1)
        .describe("How well does this represent the brand positively"),
      authenticityScore: z.number().min(0).max(1)
        .describe("Does this feel genuine vs staged/incentivized"),
      overallScore: z.number().min(0).max(1),
    }),

    brandSafetyCheck: z.object({
      passed: z.boolean(),
      issues: z.array(z.string()),
    }),

    reshareRecommendation: z.object({
      shouldReshare: z.boolean(),
      bestPlatform: z.string(),
      suggestedCaption: z.string(),
      creditFormat: z.string().describe("'📸 @username', 'Shared from @username'"),
    }).optional(),

    permissionMessage: z.object({
      message: z.string(),
      tone: z.string(),
    }),
  })),

  summary: z.object({
    totalDiscovered: z.number(),
    qualifiedForOutreach: z.number(),
    topCandidate: z.string(),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Permission Flow

```typescript
// DM template (stored in DB — EmailTemplate or equivalent)
const permissionTemplates = {
  standard: `Hi {{authorName}}! 👋 We love your post about {{brandName}}! Would you be okay with us resharing it on our page? We'd credit you of course! Just reply "yes" if that's cool 💛`,
  influencer: `Hey {{authorName}}! Amazing content — we'd love to feature this on {{brandName}}'s official page with full credit to you. Would that be alright?`,
  review_photo: `Hi {{authorName}}! Thank you for the wonderful review and great photo! We'd love to share it with our community. Would you give us permission? We'll tag you! 🙏`,
};
```

---

## Database

```prisma
model UGCCandidate {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  platform        Platform
  authorHandle    String
  authorFollowers Int
  sourceUrl       String
  contentType     String
  originalCaption String?  @db.Text
  qualityScore    Float
  brandAlignment  Float
  overallScore    Float
  brandSafe       Boolean
  brandSafetyIssues String[]
  status          String   @default("discovered")
  // discovered → permission_requested → permission_granted → scheduled → reshared
  // discovered → permission_requested → permission_denied
  // discovered → rejected (by AI or human)
  permissionRequestedAt DateTime?
  permissionResponseAt  DateTime?
  permissionGranted     Boolean?
  reshareCaption  String?  @db.Text
  reshareContentId String? // Links to content record once queued
  discoveredAt    DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, sourceUrl])
  @@index([organizationId, status])
}
```

---

## Schedule

```typescript
// Every 6 hours: discover new UGC
export const ugcDiscovery = inngest.createFunction(
  { id: "ugc-discovery" },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    // 1. For each org: pull tagged posts, brand hashtag posts, mentions with media
    // 2. Filter out already-seen URLs
    // 3. Run LLM evaluation on new candidates
    // 4. For candidates with overallScore >= threshold: queue permission request
  }
);

// On permission granted: queue for reshare
export const ugcPermissionGranted = inngest.createFunction(
  { id: "ugc-permission-granted" },
  { event: "ugc/permission-granted" },
  async ({ event, step }) => {
    // 1. Create content record with reshare caption + credit
    // 2. Download media to Supabase Storage
    // 3. Route through Compliance Agent
    // 4. Queue for publishing
  }
);
```

---

## Rules

1. **ALWAYS request permission before resharing.** No exceptions, even for tagged posts.
2. **ALWAYS credit the original creator.** Tag them in the reshare.
3. **Brand safety is non-negotiable.** Even great UGC gets rejected if it shows anything off-brand.
4. **Respect "no" answers.** If denied, mark as permission_denied and never ask again for that post.
5. **Don't over-request.** Max 3 permission requests per org per day to avoid seeming spammy.
6. **Rate limit per author.** Don't send multiple permission requests to the same person in a week.
