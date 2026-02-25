---
name: localization
description: "Translates and culturally adapts content for multi-market clients. Not just language — adjusts references, humor, hashtags, posting times, and visual cues for different regional audiences."
---

# SKILL: Localization Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Takes approved content and adapts it for different regional markets. Goes far beyond translation — adjusts cultural references, humor, idioms, hashtags, emojis, visual cues, posting times, and even content strategy per locale. A US post about "Super Bowl weekend" becomes a UK post about "Six Nations Saturday" or a Brazilian post about "Carnaval."

Enables clients to manage multi-market social presence from a single dashboard.

---

## File Location

```
agents/localization.ts
lib/ai/prompts/localization.ts
lib/ai/schemas/localization.ts
inngest/functions/localize-content.ts
```

---

## Input Interface

```typescript
interface LocalizationInput {
  organizationId: string;
  contentId: string;
  sourceContent: {
    caption: string;
    hashtags: string[];
    platform: Platform;
    contentType: string;
    mediaPrompt?: string;
    altText?: string;
  };
  sourceLocale: string;          // "en-US"
  targetLocales: string[];       // ["en-GB", "pt-BR", "es-MX", "fr-FR"]
  brandConfig: BrandConfig;
  localeConfigs: LocaleConfig[]; // From DB — per-locale settings
}

interface LocaleConfig {
  locale: string;               // "en-GB"
  displayName: string;          // "United Kingdom"
  language: string;             // "English"
  timezone: string;             // "Europe/London"
  culturalNotes: string;        // "Use British spelling. Avoid US-centric sports/holidays."
  forbiddenTopics: string[];    // Topics to avoid in this market
  localHashtags: string[];      // Market-specific default hashtags
  toneAdjustment: string;       // "Slightly more formal than US", "Very casual"
  currencySymbol: string;
  dateFormat: string;           // "DD/MM/YYYY"
  measurementSystem: string;    // "metric"
}
```

---

## Output Schema

```typescript
const LocalizationOutputSchema = z.object({
  localizations: z.array(z.object({
    targetLocale: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    mediaPrompt: z.string().optional()
      .describe("If the visual needs adaptation — different imagery, text overlay language"),
    altText: z.string().optional(),

    adaptations: z.array(z.object({
      type: z.enum([
        "language_translation",
        "cultural_reference_swap",
        "humor_adaptation",
        "idiom_replacement",
        "holiday_swap",
        "unit_conversion",
        "currency_conversion",
        "hashtag_localization",
        "emoji_adjustment",
        "tone_shift",
        "content_removal",       // Removed something inappropriate for this market
        "content_addition",      // Added something relevant for this market
      ]),
      original: z.string(),
      adapted: z.string(),
      reasoning: z.string(),
    })),

    warnings: z.array(z.string())
      .describe("Potential cultural sensitivities or issues with this localization"),

    skipRecommendation: z.boolean()
      .describe("True if this content should NOT be posted in this locale at all"),
    skipReason: z.string().optional(),

    confidenceScore: z.number().min(0).max(1),
  })),

  overallConfidenceScore: z.number().min(0).max(1),
});
```

---

## System Prompt Core

```
You are a cultural localization expert adapting social media content from ${sourceLocale} to ${targetLocale} for ${brandName}.

You do NOT just translate. You CULTURALLY ADAPT. This means:

1. LANGUAGE: Translate naturally, not literally. Use local idioms and phrasing. Match the formality level specified for this locale.
2. REFERENCES: Replace cultural references the target audience won't understand.
   - US sports → local sports equivalents
   - US holidays → local holidays or remove
   - Pop culture → locally relevant pop culture
   - Food references → locally relevant equivalents
3. HUMOR: Humor doesn't translate literally. Adapt the joke mechanism, not the words.
4. HASHTAGS: Use trending/popular hashtags in the TARGET locale. Don't translate English hashtags literally.
5. UNITS: Convert imperial to metric (or vice versa) where relevant.
6. CURRENCY: Convert and use local currency symbol.
7. DATES: Use the local date format.
8. EMOJIS: Some emojis have different cultural meanings. Adjust if needed.
9. TONE: Apply the tone adjustment for this locale.
10. SKIP ENTIRELY: If the content is fundamentally irrelevant or inappropriate for this market, recommend skipping with a reason.

CRITICAL RULES:
- Never produce content that's offensive in the target culture.
- Research-level accuracy on cultural references — don't guess.
- Maintain the brand's core message while adapting the wrapper.
- Flag if the visual/image also needs adaptation (text overlays, culturally specific imagery).

LOCALE-SPECIFIC NOTES:
${localeConfig.culturalNotes}
Forbidden topics: ${localeConfig.forbiddenTopics.join(", ")}
Tone: ${localeConfig.toneAdjustment}
```

---

## Database

```prisma
model LocaleConfig {
  id               String   @id @default(uuid())
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  locale           String       // "en-GB", "pt-BR", "es-MX"
  displayName      String       // "United Kingdom", "Brazil"
  language         String
  timezone         String
  culturalNotes    String   @db.Text
  forbiddenTopics  String[]
  localHashtags    String[]
  toneAdjustment   String
  currencySymbol   String   @default("$")
  dateFormat       String   @default("MM/DD/YYYY")
  measurementSystem String  @default("imperial")
  isEnabled        Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([organizationId, locale])
}

model LocalizedContent {
  id              String   @id @default(uuid())
  contentId       String
  content         Content  @relation(fields: [contentId], references: [id], onDelete: Cascade)
  locale          String
  caption         String   @db.Text
  hashtags        String[]
  adaptations     Json
  mediaPrompt     String?  @db.Text
  skipped         Boolean  @default(false)
  skipReason      String?
  confidenceScore Float
  createdAt       DateTime @default(now())

  @@unique([contentId, locale])
}
```

Admin UI: Dashboard → Settings → Locales (add/remove target markets, configure cultural notes per locale).

---

## Trigger Modes

```typescript
// Auto-trigger: when content is approved, localize for all active locales
export const localizeOnApproval = inngest.createFunction(
  { id: "localize-on-approval" },
  { event: "content/approved" },
  async ({ event, step }) => {
    const locales = await step.run("get-active-locales", async () => {
      return prisma.localeConfig.findMany({
        where: { organizationId: event.data.organizationId, isEnabled: true },
      });
    });

    if (locales.length === 0) return; // No localization configured

    const result = await step.run("localize", async () => {
      const agent = new LocalizationAgent();
      return agent.run(event.data.organizationId, {
        contentId: event.data.contentId,
        sourceContent: event.data.content,
        sourceLocale: "en-US",
        targetLocales: locales.map(l => l.locale),
        brandConfig: event.data.brandConfig,
        localeConfigs: locales,
      });
    });

    // Create localized content records + schedule for each locale
    for (const localized of result.data.localizations) {
      if (localized.skipRecommendation) continue;

      await step.run(`save-${localized.targetLocale}`, async () => {
        await prisma.localizedContent.create({ data: { /* ... */ } });
        // Route through Compliance Agent for locale-specific checks
        await inngest.send({
          name: "content/compliance-check",
          data: { contentId: localized.id, locale: localized.targetLocale },
        });
      });
    }
  }
);

// Manual: user clicks "Localize" on a content item
export const localizeManual = inngest.createFunction(
  { id: "localize-manual" },
  { event: "content/localize-requested" },
  async ({ event, step }) => { /* Same flow, specific locales from user selection */ }
);
```

---

## Integration

```
Localization Agent
├── localizedContent → Compliance Agent (locale-specific compliance check)
├── localizedContent → Publisher Agent (schedule per locale timezone)
├── mediaPrompt changes → Visual Agent (regenerate images with locale-specific text)
└── skipRecommendations → Dashboard (show which locales were skipped and why)
```

---

## Quality Rules

1. **Never publish literal translations.** Every output must feel native to the target locale.
2. **Compliance runs AGAIN on localized content.** Different markets have different regulations.
3. **Publishing times adapt to locale timezone.** A 9am US post becomes 9am local time for each market.
4. **Visual content may need re-generation.** If the image has text overlays, they need translating via Visual Agent.
5. **Track performance per locale.** Analytics Agent should segment metrics by locale.
