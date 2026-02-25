import { z } from "zod";

export const LocalizationOutputSchema = z.object({
  localizations: z.array(z.object({
    targetLocale: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    mediaPrompt: z.string().optional(),
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
        "content_removal",
        "content_addition",
      ]),
      original: z.string(),
      adapted: z.string(),
      reasoning: z.string(),
    })),
    warnings: z.array(z.string()),
    skipRecommendation: z.boolean(),
    skipReason: z.string().optional(),
    confidenceScore: z.number().min(0).max(1),
  })),
  overallConfidenceScore: z.number().min(0).max(1),
});

export type LocalizationOutput = z.infer<typeof LocalizationOutputSchema>;

export interface LocalizationInput {
  organizationId: string;
  contentId: string;
  sourceContent: {
    caption: string;
    hashtags: string[];
    platform: string;
    contentType: string;
    mediaPrompt?: string;
    altText?: string;
  };
  sourceLocale: string;
  targetLocales: string[];
  brandConfig: {
    brandName: string;
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    contentThemes: string[];
  };
  localeConfigs: Array<{
    locale: string;
    displayName: string;
    language: string;
    timezone: string;
    culturalNotes: string;
    forbiddenTopics: string[];
    localHashtags: string[];
    toneAdjustment: string;
    currencySymbol: string;
    dateFormat: string;
    measurementSystem: string;
  }>;
}
