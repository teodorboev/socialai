---
name: ai-training-mode
description: "Let clients teach the AI by rating outputs and providing corrections. Stores per-org fine-tuning signals. Agents get better over time for each specific client. Creates massive switching costs — the longer they use it, the harder it is to leave."
---

# SKILL: AI Training Mode

> This is NOT an agent — it's a system-wide feature skill that enhances ALL agents.

---

## Purpose

Lets clients teach their AI by providing feedback on every output: thumbs up/down, corrections, style preferences, and explicit instructions. This feedback is stored per-org and injected into future agent prompts as few-shot examples. Over time, each client's agents become uniquely tuned to them — creating switching costs that make churn nearly impossible.

"The AI learned that I never want emojis on LinkedIn" — that's training mode.

---

## File Location

```
lib/training/feedback.ts
lib/training/prompt-injection.ts
lib/training/preference-learner.ts
app/(dashboard)/settings/ai-training/page.tsx
components/feedback/thumbs-rating.tsx
components/feedback/correction-modal.tsx
```

---

## Feedback Types

| Type | UI Element | What It Captures |
|------|-----------|-----------------|
| Quick Rating | 👍/👎 on every content item | Binary quality signal |
| Star Rating | ⭐⭐⭐⭐⭐ on published content | Granular quality score |
| Correction | "Edit & Submit" on any output | What was wrong + correct version |
| Preference | "Always do X" / "Never do Y" rules | Explicit preference rules |
| Example | "Posts like this" bookmarks | Positive exemplars |
| Rejection Reason | Dropdown when rejecting content | Why content was rejected |

---

## Database

```prisma
model AIFeedback {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contentId       String?
  agentName       AgentName
  feedbackType    String   // "thumbs", "star", "correction", "rejection"
  rating          Int?     // 1-5 for stars, 1=thumbs up 0=thumbs down
  originalOutput  String?  @db.Text
  correctedOutput String?  @db.Text
  rejectionReason String?  // "off_brand", "too_long", "wrong_tone", "factual_error", "not_relevant", "bad_timing"
  notes           String?  @db.Text
  userId          String   // Who gave the feedback
  createdAt       DateTime @default(now())

  @@index([organizationId, agentName])
  @@index([organizationId, feedbackType])
  @@index([organizationId, createdAt])
}

model AIPreference {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  agentName       AgentName?  // null = applies to all agents
  platform        Platform?   // null = applies to all platforms
  rule            String      // "Never use emojis on LinkedIn"
  ruleType        String      // "always", "never", "prefer", "avoid"
  isActive        Boolean  @default(true)
  source          String   // "explicit" (user typed it), "learned" (derived from feedback patterns)
  confidence      Float    @default(1.0) // 1.0 for explicit rules, lower for learned
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, agentName])
}

model AIExemplar {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  agentName       AgentName
  platform        Platform?
  contentType     String?
  content         String   @db.Text // The actual exemplar text
  context         String?  @db.Text // Why this is good
  rating          Int      @default(5) // How strongly to weight this exemplar
  source          String   // "bookmarked" (user saved), "top_performer" (auto-detected), "correction" (from corrected output)
  createdAt       DateTime @default(now())

  @@index([organizationId, agentName])
}
```

---

## Prompt Injection System

Every agent's prompt gets injected with learned context before execution:

```typescript
// lib/training/prompt-injection.ts

async function getTrainingContext(
  organizationId: string,
  agentName: AgentName,
  platform?: Platform,
): Promise<string> {
  // 1. Get explicit preferences
  const preferences = await prisma.aIPreference.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { agentName },
        { agentName: null }, // Global preferences
      ],
    },
  });

  // 2. Get top exemplars (max 5 to keep prompt size reasonable)
  const exemplars = await prisma.aIExemplar.findMany({
    where: { organizationId, agentName, ...(platform ? { platform } : {}) },
    orderBy: { rating: "desc" },
    take: 5,
  });

  // 3. Get recent corrections (max 3 most recent)
  const corrections = await prisma.aIFeedback.findMany({
    where: {
      organizationId,
      agentName,
      feedbackType: "correction",
      correctedOutput: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // 4. Get learned patterns (from rejection analysis)
  const learnedPatterns = await getLearnedPatterns(organizationId, agentName);

  // 5. Compose training block
  return composeTrainingBlock(preferences, exemplars, corrections, learnedPatterns);
}

function composeTrainingBlock(
  preferences: AIPreference[],
  exemplars: AIExemplar[],
  corrections: AIFeedback[],
  patterns: LearnedPattern[],
): string {
  let block = `\n\n--- CLIENT-SPECIFIC TRAINING CONTEXT ---\n`;

  if (preferences.length > 0) {
    block += `\nEXPLICIT RULES (follow these strictly):\n`;
    for (const pref of preferences) {
      block += `- ${pref.ruleType.toUpperCase()}: ${pref.rule}\n`;
    }
  }

  if (exemplars.length > 0) {
    block += `\nEXEMPLAR POSTS (match this quality and style):\n`;
    for (const ex of exemplars) {
      block += `- [${ex.platform ?? "any"}] "${ex.content.slice(0, 200)}"\n`;
      if (ex.context) block += `  Why it's good: ${ex.context}\n`;
    }
  }

  if (corrections.length > 0) {
    block += `\nRECENT CORRECTIONS (learn from these mistakes):\n`;
    for (const cor of corrections) {
      block += `- ORIGINAL: "${cor.originalOutput?.slice(0, 150)}"\n`;
      block += `  CORRECTED TO: "${cor.correctedOutput?.slice(0, 150)}"\n`;
    }
  }

  if (patterns.length > 0) {
    block += `\nLEARNED PATTERNS:\n`;
    for (const pat of patterns) {
      block += `- ${pat.pattern} (confidence: ${pat.confidence})\n`;
    }
  }

  block += `\n--- END TRAINING CONTEXT ---\n`;
  return block;
}
```

---

## Pattern Learning

Automatically derive preferences from feedback patterns:

```typescript
// lib/training/preference-learner.ts

interface LearnedPattern {
  pattern: string;
  confidence: number;
  evidenceCount: number;
}

async function derivePatterns(organizationId: string, agentName: AgentName): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];

  // Analyze rejection reasons
  const rejections = await prisma.aIFeedback.groupBy({
    by: ["rejectionReason"],
    where: { organizationId, agentName, feedbackType: "rejection" },
    _count: true,
    orderBy: { _count: { rejectionReason: "desc" } },
  });

  for (const rejection of rejections) {
    if (rejection._count >= 3) {
      patterns.push({
        pattern: `Content is frequently rejected for: ${rejection.rejectionReason}`,
        confidence: Math.min(rejection._count / 10, 0.95),
        evidenceCount: rejection._count,
      });
    }
  }

  // Analyze thumbs down patterns via LLM
  const negatives = await prisma.aIFeedback.findMany({
    where: { organizationId, agentName, feedbackType: "thumbs", rating: 0 },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (negatives.length >= 5) {
    // Run LLM to identify common patterns in rejected content
    // "Looking at 15 rejected posts, I notice they all use questions as hooks,
    //  are longer than 200 characters, and mention competitors..."
    const analysis = await analyzeRejectionPatterns(negatives);
    patterns.push(...analysis);
  }

  return patterns;
}
```

---

## Schedule

```typescript
// Weekly: analyze feedback and derive new patterns
export const trainingPatternAnalysis = inngest.createFunction(
  { id: "training-pattern-analysis" },
  { cron: "0 4 * * 0" },  // Sunday 4am
  async ({ step }) => {
    // 1. For each org with sufficient feedback (>10 feedback items)
    // 2. Run pattern derivation
    // 3. Create/update AIPreference records with source="learned"
    // 4. Auto-detect top-performing posts as exemplars
  }
);
```

---

## Dashboard UI

### Feedback Components (embedded everywhere)

```typescript
// components/feedback/thumbs-rating.tsx
// Appears on every content item in the review queue, content calendar, and published content view
// 👍 👎 + optional "Tell us why" text field

// components/feedback/correction-modal.tsx
// "Edit & Submit Correction" button on any content item
// Shows original on left, editable version on right
// On submit: stores both versions as AIFeedback with type="correction"
// Also creates an AIExemplar from the corrected version
```

### AI Training Settings Page (Dashboard → Settings → AI Training)

```
┌─────────────────────────────────────────┐
│ AI Training Settings                    │
├─────────────────────────────────────────┤
│                                         │
│ Explicit Rules                          │
│ ┌─────────────────────────────────────┐ │
│ │ ☑ Never use emojis on LinkedIn     │ │
│ │ ☑ Always start Instagram posts     │ │
│ │   with a hook question             │ │
│ │ ☑ Avoid mentioning competitor X    │ │
│ │ ☑ Prefer short captions (<150      │ │
│ │   chars) on Twitter                │ │
│ │ [+ Add Rule]                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Learned Patterns (auto-detected)        │
│ ┌─────────────────────────────────────┐ │
│ │ 🔵 Posts with statistics get 40%   │ │
│ │   more engagement (confidence: 82%)│ │
│ │ 🔵 Content rejected most often for │ │
│ │   "too long" (7 rejections)        │ │
│ │ 🔵 Question hooks outperform       │ │
│ │   statement hooks 2:1 (conf: 75%)  │ │
│ │ [Approve] [Dismiss] for each       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Exemplar Posts (bookmarked as ideal)    │
│ ┌─────────────────────────────────────┐ │
│ │ ⭐ "Did you know that 73% of..."   │ │
│ │   Platform: Instagram | Type: POST │ │
│ │ ⭐ "3 things we learned from..."   │ │
│ │   Platform: LinkedIn | Type: POST  │ │
│ │ [+ Bookmark a Post]               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Training Stats                          │
│ Total feedback given: 247               │
│ Corrections submitted: 34               │
│ Active rules: 12                        │
│ Learned patterns: 8                     │
│ AI accuracy trend: 73% → 89% (+16%)   │
│                                         │
│ [Reset All Training Data]               │
└─────────────────────────────────────────┘
```

---

## Integration with BaseAgent

```typescript
// Modify BaseAgent to automatically inject training context:

abstract class BaseAgent {
  async run(organizationId: string, input: unknown): Promise<AgentResult<unknown>> {
    // NEW: Get training context for this org + agent
    const trainingContext = await getTrainingContext(
      organizationId,
      this.agentName,
      input.platform, // if applicable
    );

    // Inject into the execute method's system prompt
    const enrichedInput = {
      ...input,
      _trainingContext: trainingContext,
    };

    // ... rest of run() method
  }
}

// Each agent's execute() method appends _trainingContext to the system prompt:
// const systemPrompt = basePrompt + input._trainingContext;
```

---

## Rules

1. **Training context is additive.** It supplements the system prompt, never replaces it.
2. **Cap training context size.** Max 2000 tokens of training context per prompt to avoid overwhelming the LLM.
3. **Explicit rules override learned patterns.** If a user says "always do X" but learned patterns say "avoid X", the explicit rule wins.
4. **Decay old feedback.** Feedback older than 90 days gets progressively less weight. Brands evolve.
5. **Track accuracy improvement.** Show clients their AI accuracy trend — "Your AI was 73% accurate in month 1, now 89% in month 3."
6. **Never expose training data across orgs.** Training is strictly per-organization. RLS applies.
7. **Allow full reset.** Clients can clear all training data and start fresh if they reposition their brand.
