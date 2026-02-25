---
name: review-response
description: "Monitors and responds to Google Reviews, Yelp, Facebook Reviews, TrustPilot. Drafts personalized responses, escalates negative reviews, tracks review sentiment trends. Directly impacts local SEO."
---

# SKILL: Review Response Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Monitors business review platforms and generates personalized, on-brand responses to every review. Positive reviews get genuine thank-yous that reference specific things the reviewer mentioned. Negative reviews get empathetic, solution-oriented responses that demonstrate the brand cares. Escalates serious complaints to the human team.

Review response rate and quality directly impact local SEO rankings and customer trust.

---

## File Location

```
agents/review-response.ts
lib/ai/prompts/review-response.ts
lib/ai/schemas/review-response.ts
inngest/functions/review-monitor.ts
```

---

## Platforms Supported

| Platform | API | Auth |
|----------|-----|------|
| Google Business | Google Business Profile API | OAuth2 |
| Facebook | Meta Graph API (page reviews) | Existing Meta OAuth |
| Yelp | Yelp Fusion API | API Key |
| TrustPilot | TrustPilot Business API | API Key |

---

## Output Schema

```typescript
const ReviewResponseSchema = z.object({
  reviewId: z.string(),
  platform: z.string(),
  reviewer: z.string(),
  rating: z.number(),
  reviewText: z.string(),

  analysis: z.object({
    sentiment: z.enum(["positive", "neutral", "mixed", "negative", "hostile"]),
    topics: z.array(z.string()).describe("What specific things they mentioned: 'service speed', 'food quality', 'staff friendliness'"),
    urgency: z.enum(["routine", "attention_needed", "urgent", "critical"]),
    requiresHumanResponse: z.boolean(),
    humanReason: z.string().optional(),
  }),

  response: z.object({
    message: z.string(),
    tone: z.enum(["grateful", "empathetic", "professional", "apologetic", "solution_oriented"]),
    personalizationPoints: z.array(z.string())
      .describe("Specific details from the review referenced in the response"),
    includesResolution: z.boolean()
      .describe("Does the response offer a concrete next step or solution"),
    resolution: z.string().optional(),
  }),

  followUpActions: z.array(z.object({
    action: z.string(),
    assignTo: z.enum(["social_team", "customer_support", "management", "none"]),
    priority: z.enum(["low", "medium", "high"]),
  })),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Response Strategy by Rating

```
5 stars: Grateful, specific thank-you referencing details they loved.
         "Thank you for highlighting our [specific thing]! It means a lot..."

4 stars: Thank-you with acknowledgment of room for improvement.
         "We're glad you enjoyed [specific thing]! We'll work on [their concern]..."

3 stars: Balanced — appreciate the feedback, address concerns, offer resolution.
         "Thank you for the honest feedback. We hear you about [concern] and..."

2 stars: Empathetic, solution-focused, invite offline conversation.
         "We're sorry your experience fell short. [Specific acknowledgment]. We'd love to make it right — could you reach out to [contact]?"

1 star:  Apologetic, take responsibility, offer concrete resolution, invite direct contact.
         ALWAYS escalate to human before posting.
```

---

## Database

```prisma
model ReviewPlatformAccount {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  platform        String   // "google", "yelp", "facebook", "trustpilot"
  accountId       String   // Platform-specific business ID
  accessToken     String?  @db.Text // Encrypted
  isEnabled       Boolean  @default(true)
  lastSyncedAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, platform])
}

model Review {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  platform        String
  platformReviewId String
  reviewerName    String
  rating          Int
  reviewText      String?  @db.Text
  sentiment       String?
  topics          String[]
  responseText    String?  @db.Text
  responseStatus  String   @default("pending") // pending → auto_responded → human_responded → escalated
  respondedAt     DateTime?
  detectedAt      DateTime @default(now())

  @@unique([organizationId, platform, platformReviewId])
  @@index([organizationId, responseStatus])
  @@index([organizationId, rating])
}
```

---

## Schedule

```typescript
// Every 2 hours: check for new reviews
export const reviewMonitor = inngest.createFunction(
  { id: "review-monitor" },
  { cron: "0 */2 * * *" },
  async ({ step }) => {
    // 1. For each org with review platform accounts
    // 2. Fetch new reviews since lastSyncedAt
    // 3. Store in reviews table
    // 4. Run ReviewResponseAgent on each new review
    // 5. 4-5 star reviews with high confidence: auto-respond
    // 6. 1-3 star reviews: queue for human review with suggested response
    // 7. Update lastSyncedAt
  }
);
```

---

## Confidence & Auto-Response Rules

| Rating | Auto-Respond? | Condition |
|--------|:---:|-----------|
| 5 ★ | ✅ | If confidence ≥ org threshold |
| 4 ★ | ✅ | If confidence ≥ org threshold AND no complaints in review |
| 3 ★ | ❌ | Always queue for human review |
| 2 ★ | ❌ | Always queue for human review |
| 1 ★ | ❌ | Always escalate as HIGH priority |

---

## Rules

1. **Every response must reference something SPECIFIC from the review.** No generic "Thanks for your feedback!"
2. **Never argue with a reviewer.** Even if the complaint is unfair.
3. **Never promise refunds or compensation in public.** Invite them to contact directly.
4. **Never reveal private customer information** in a public response.
5. **Response within 24 hours** — speed matters for SEO and perception.
6. **Track review sentiment trends.** Alert if average rating drops significantly.
