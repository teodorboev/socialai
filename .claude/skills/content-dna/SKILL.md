---
name: content-dna
description: "Extracts the 'DNA' of high-performing content — the specific combination of hook, topic, format, length, timing, visual style, and hashtags that made it work. Builds a per-client DNA profile. New content is engineered to replicate winning DNA while varying the surface."
---

# SKILL: Content DNA Fingerprinting

> This is a SYSTEM skill that enhances the Content Creator and Strategy agents.
> **Prerequisite**: Read `base-agent` and `shared-memory` skills first.

---

## Purpose

Why did that one carousel get 8% engagement while everything else gets 2%? It wasn't luck. It was a specific combination of factors: the hook was a number ("5 things..."), the topic hit an audience pain point, it was posted Tuesday at 9am, the visual was a clean text overlay with one color, and the hashtags mixed niche + discovery.

Content DNA extracts this winning combination from every high performer and encodes it as a reproducible fingerprint. When generating new content, the system doesn't just create "a post about skincare" — it engineers a post with the DNA signature that has the highest probability of success for this specific client.

---

## File Location

```
lib/content-dna/fingerprint.ts
lib/content-dna/profile.ts
lib/content-dna/synthesizer.ts
```

---

## DNA Dimensions

Every piece of content is fingerprinted across these dimensions:

```typescript
interface ContentDNA {
  contentId: string;
  organizationId: string;
  platform: string;

  // HOOK DNA
  hook: {
    type: string;           // "question", "statistic", "bold_claim", "story_opener", "how_to", "list_number", "controversy", "curiosity_gap"
    length: number;         // Characters in first line
    usesNumber: boolean;    // "5 things..." "73% of..."
    usesEmoji: boolean;
    usesYou: boolean;       // Addresses reader directly
    emotionalTone: string;  // "surprise", "urgency", "curiosity", "empathy", "authority"
  };

  // CONTENT DNA
  content: {
    topic: string;
    subtopic: string;
    angle: string;          // "educational", "inspirational", "entertaining", "promotional", "behind_scenes"
    structure: string;      // "tip_list", "story_arc", "problem_solution", "before_after", "myth_bust", "how_to"
    captionLength: number;
    paragraphCount: number;
    usesLineBreaks: boolean;
    readabilityLevel: string; // "simple", "moderate", "complex"
    callToAction: string;   // "save", "comment", "click_link", "follow", "share", "none"
    ctaPlacement: string;   // "end", "middle", "beginning"
  };

  // VISUAL DNA
  visual: {
    type: string;           // "ai_photo", "product_shot", "text_overlay", "carousel", "reel", "infographic"
    dominantColor: string;
    brightness: string;     // "light", "medium", "dark"
    hasText: boolean;
    textAmount: string;     // "none", "minimal", "moderate", "heavy"
    hasProduct: boolean;
    hasPerson: boolean;
    layout: string;         // "centered", "left_aligned", "full_bleed", "split"
    slideCount?: number;    // For carousels
  };

  // TIMING DNA
  timing: {
    dayOfWeek: number;
    hourOfDay: number;
    isWeekend: boolean;
    seasonalContext: string; // "none", "holiday_adjacent", "seasonal_topic", "cultural_moment"
  };

  // DISTRIBUTION DNA
  distribution: {
    hashtagCount: number;
    hashtagMix: string;     // "mostly_niche", "mostly_discovery", "balanced", "branded_heavy"
    mentionsCount: number;
    hasLocation: boolean;
  };

  // PERFORMANCE (filled after 7 days)
  performance?: {
    engagementRate: number;
    reachRate: number;
    saveRate: number;
    shareRate: number;
    commentRate: number;
    clickRate: number;
    percentileRank: number;
  };
}
```

---

## DNA Profile (Per-Client Winning Formula)

```typescript
interface DNAProfile {
  organizationId: string;
  platform: string;
  lastUpdated: Date;
  sampleSize: number;        // How many posts analyzed

  // Winning combinations (sorted by performance)
  winningFormulas: Array<{
    name: string;             // Auto-generated: "Educational List + Stat Hook + Morning"
    dnaSignature: Partial<ContentDNA>;
    avgEngagementRate: number;
    avgPercentileRank: number;
    occurrences: number;      // How many posts match this formula
    consistency: number;      // 0-1: how consistently this formula performs well
    lastUsed: Date;
    fatigue: number;          // 0-1: how overused this formula is becoming
  }>;

  // Losing combinations (what to avoid)
  losingFormulas: Array<{
    name: string;
    dnaSignature: Partial<ContentDNA>;
    avgEngagementRate: number;
    avgPercentileRank: number;
    occurrences: number;
    reason: string;           // LLM-generated explanation of why this fails
  }>;

  // Dimension-level insights
  dimensionInsights: {
    bestHookTypes: Array<{ type: string; avgPerformance: number }>;
    bestContentAngles: Array<{ angle: string; avgPerformance: number }>;
    bestVisualTypes: Array<{ type: string; avgPerformance: number }>;
    bestTimingSlots: Array<{ day: number; hour: number; avgPerformance: number }>;
    bestCaptionLength: { min: number; max: number; optimal: number };
    bestHashtagCount: { min: number; max: number; optimal: number };
  };
}
```

---

## Database

```prisma
model ContentFingerprint {
  id              String   @id @default(uuid())
  contentId       String   @unique
  organizationId  String
  platform        Platform
  dna             Json     // Full ContentDNA object
  performanceData Json?    // Filled after 7 days
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, platform])
}

model DNAProfile {
  id              String   @id @default(uuid())
  organizationId  String
  platform        Platform
  winningFormulas Json
  losingFormulas  Json
  dimensionInsights Json
  sampleSize      Int
  lastUpdated     DateTime @default(now())

  @@unique([organizationId, platform])
}
```

---

## Building the Profile

```typescript
// Runs weekly after Self-Evaluation completes

async function updateDNAProfile(organizationId: string, platform: Platform): Promise<DNAProfile> {
  // 1. Get all fingerprinted content with performance data
  const fingerprints = await prisma.contentFingerprint.findMany({
    where: { organizationId, platform, performanceData: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (fingerprints.length < 20) return; // Not enough data to build a profile

  // 2. Cluster high performers (top 25%)
  const sorted = fingerprints.sort((a, b) =>
    b.performanceData.percentileRank - a.performanceData.percentileRank
  );
  const topQuartile = sorted.slice(0, Math.floor(sorted.length * 0.25));
  const bottomQuartile = sorted.slice(Math.floor(sorted.length * 0.75));

  // 3. Find common DNA patterns in top performers
  const winningPatterns = findCommonPatterns(topQuartile);
  const losingPatterns = findCommonPatterns(bottomQuartile);

  // 4. LLM analysis to name and explain patterns
  const analysis = await analyzePatterns(winningPatterns, losingPatterns, fingerprints);

  // 5. Calculate dimension-level insights
  const dimensionInsights = calculateDimensionInsights(fingerprints);

  // 6. Calculate fatigue scores (winning formulas used too often lose power)
  for (const formula of analysis.winningFormulas) {
    const recentUses = fingerprints.filter(f =>
      matchesFormula(f.dna, formula.dnaSignature) &&
      f.createdAt > subDays(new Date(), 14)
    ).length;
    formula.fatigue = Math.min(recentUses / 5, 1); // Fatigue at 1.0 if used 5+ times in 14 days
  }

  // 7. Store profile
  return prisma.dNAProfile.upsert({
    where: { organizationId_platform: { organizationId, platform } },
    update: {
      winningFormulas: analysis.winningFormulas,
      losingFormulas: analysis.losingFormulas,
      dimensionInsights,
      sampleSize: fingerprints.length,
      lastUpdated: new Date(),
    },
    create: {
      organizationId,
      platform,
      winningFormulas: analysis.winningFormulas,
      losingFormulas: analysis.losingFormulas,
      dimensionInsights,
      sampleSize: fingerprints.length,
    },
  });
}
```

---

## Content Creator Integration

When Content Creator generates a post, it receives the DNA profile:

```typescript
// Injected into Content Creator's system prompt:

const dnaContext = `
CONTENT DNA PROFILE FOR ${platform}:

YOUR WINNING FORMULAS (create content matching these patterns):
${profile.winningFormulas
  .filter(f => f.fatigue < 0.8)  // Skip fatigued formulas
  .slice(0, 3)
  .map((f, i) => `${i + 1}. "${f.name}" (avg ${f.avgPercentileRank}th percentile, consistency: ${(f.consistency * 100).toFixed(0)}%)
   DNA: ${JSON.stringify(f.dnaSignature)}`)
  .join("\n")}

AVOID THESE PATTERNS (they consistently underperform):
${profile.losingFormulas.slice(0, 3).map(f =>
  `- "${f.name}": ${f.reason}`
).join("\n")}

TOP-LEVEL INSIGHTS:
- Best hooks: ${profile.dimensionInsights.bestHookTypes.slice(0, 3).map(h => h.type).join(", ")}
- Best angles: ${profile.dimensionInsights.bestContentAngles.slice(0, 3).map(a => a.angle).join(", ")}
- Optimal caption length: ${profile.dimensionInsights.bestCaptionLength.optimal} chars
- Optimal hashtags: ${profile.dimensionInsights.bestHashtagCount.optimal}

FATIGUE WARNING:
${profile.winningFormulas.filter(f => f.fatigue > 0.7).map(f =>
  `- "${f.name}" has been used ${Math.round(f.fatigue * 5)} times recently — mix in variety`
).join("\n") || "No formulas are fatigued — proceed normally."}

INSTRUCTION: Engineer new content to match a winning formula while keeping the surface-level content fresh and original. Vary the specific topic and words, but match the underlying DNA structure.
`;
```

---

## Fatigue Management

The system prevents formula burnout:

```
Week 1: "Stat hook + educational list + morning post" → 7.2% engagement ✅
Week 2: Same formula → 5.8% engagement (still good)
Week 3: Same formula → 3.4% engagement (fatigue kicking in)
Week 4: System flags fatigue → rotates to "Story hook + problem-solution + evening post"
Week 5: Original formula rested → 6.9% engagement again ✅
```

---

## Rules

1. **DNA profiles require minimum 20 posts with performance data.** Don't build profiles from insufficient samples.
2. **Fatigue is real.** Even winning formulas lose power when overused. Rotate formulas actively.
3. **Surface variation is essential.** Same DNA ≠ same content. The hook TYPE should match (question), but the actual question must be different every time.
4. **Update weekly.** Audience preferences shift. Last week's winning formula might fatigue this week.
5. **Platform-specific profiles.** What works on Instagram doesn't work on LinkedIn. Separate DNA profiles per platform.
6. **The human sees this as "getting smarter."** Mission Control Weekly Pulse: "I've identified that your audience responds 3x better to numbered lists with a statistic in the hook. I'm creating more of those."
