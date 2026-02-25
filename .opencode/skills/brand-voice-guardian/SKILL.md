---
name: brand-voice-guardian
description: "Analyzes every piece of content against the client's established voice profile. Scores tone alignment, vocabulary consistency, personality match. Catches voice drift over time. Ensures the brand sounds like the same person everywhere."
---

# SKILL: Brand Voice Guardian Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Goes beyond compliance (which checks rules) into voice consistency (which checks personality). Every piece of content is scored against the client's unique voice profile. Catches subtle drift: the brand becoming too casual on LinkedIn, too corporate on Instagram, or slowly losing its distinctive voice across all platforms. Ensures the brand sounds like the same person everywhere, every time.

---

## File Location

```
agents/brand-voice-guardian.ts
lib/ai/prompts/brand-voice-guardian.ts
lib/ai/schemas/brand-voice-guardian.ts
```

---

## When It Runs

Synchronous in the content pipeline — after Content Creator, before Compliance:

```
Content Creator → Brand Voice Guardian → Compliance → Publisher
```

---

## Voice Profile (Stored in DB)

```prisma
model BrandVoiceProfile {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Core personality
  personality     String[] // ["friendly", "knowledgeable", "witty", "approachable"]
  antiPersonality String[] // ["corporate", "stiff", "salesy", "condescending"]

  // Tone spectrum (0-10 scale for each axis)
  formalityCasual     Int  @default(4) // 0=very formal, 10=very casual
  seriousPlayful      Int  @default(6) // 0=always serious, 10=always playful
  authoritativeRelatable Int @default(5) // 0=expert authority, 10=peer/friend
  reservedEnthusiastic Int @default(7) // 0=understated, 10=high energy

  // Vocabulary
  preferredWords  String[] // Words the brand loves using
  avoidWords      String[] // Words the brand never uses
  jargonLevel     String   @default("minimal") // "none", "minimal", "moderate", "heavy"
  emojiStyle      String   @default("moderate") // "none", "minimal", "moderate", "heavy"
  signaturePhrase String?  // Recurring sign-off or catchphrase

  // Platform-specific adjustments
  platformOverrides Json?  // { "linkedin": { formalityCasual: 3 }, "tiktok": { formalityCasual: 8 } }

  // Reference content (example posts that nail the voice)
  exemplarPosts   Json?    // Array of { text, platform, why } — "golden examples"

  // Calibration
  lastCalibratedAt DateTime?
  calibrationVersion Int @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## Output Schema

```typescript
const VoiceCheckSchema = z.object({
  overallScore: z.number().min(0).max(100)
    .describe("How well this content matches the brand voice. 80+ is good."),

  dimensions: z.object({
    toneAlignment: z.number().min(0).max(100),
    vocabularyConsistency: z.number().min(0).max(100),
    personalityMatch: z.number().min(0).max(100),
    platformAppropriateness: z.number().min(0).max(100),
    distinctiveness: z.number().min(0).max(100)
      .describe("Does this sound like THIS brand, or could it be anyone?"),
  }),

  issues: z.array(z.object({
    type: z.enum([
      "too_formal", "too_casual", "too_corporate", "too_salesy",
      "off_brand_vocabulary", "wrong_tone_for_platform",
      "missing_personality", "inconsistent_with_exemplars",
      "uses_avoid_words", "lacks_distinctiveness",
    ]),
    severity: z.enum(["minor", "moderate", "major"]),
    location: z.string().describe("The specific phrase or sentence"),
    explanation: z.string(),
    suggestedFix: z.string(),
  })),

  voiceDriftAlert: z.object({
    detected: z.boolean(),
    direction: z.string().optional(),
    evidence: z.string().optional(),
  }).describe("Is the overall content trending away from the established voice?"),

  rewrittenVersion: z.string().optional()
    .describe("If score < 70, provide a voice-corrected version"),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Voice Drift Detection

```typescript
// Weekly: analyze trend across all content produced this week
export const voiceDriftCheck = inngest.createFunction(
  { id: "voice-drift-check" },
  { cron: "0 7 * * 5" },  // Friday 7am
  async ({ step }) => {
    // 1. Pull all voice scores for the week per org
    // 2. Compare average to previous 4 weeks
    // 3. If average dropped >10 points: alert
    // 4. If specific dimension consistently low: recommend voice profile update
    // 5. Store trend data for reporting
  }
);
```

---

## Voice Calibration

When a client first onboards or when they request a recalibration:

```typescript
// Analyze their last 90 days of content to build/refine voice profile
async function calibrateVoiceProfile(orgId: string): Promise<BrandVoiceProfile> {
  // 1. Pull all published content
  // 2. LLM analysis: identify consistent tone, vocabulary, personality traits
  // 3. Identify exemplar posts (highest engagement + most voice-consistent)
  // 4. Generate voice profile
  // 5. Present to client for approval/tweaking
}
```

---

## Integration

```
Brand Voice Guardian Agent
├── voiceScore → Content pipeline (low score = send to review)
├── rewrittenVersion → Review queue (show side-by-side)
├── voiceDriftAlert → Org admin notification
├── dimensionScores → Analytics / Reporting Narrator
└── platformAppropriateness → Calendar Optimizer (move content to better-fit platform)
```
