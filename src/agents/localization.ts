import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { LocalizationOutputSchema, type LocalizationInput } from "@/lib/ai/schemas/localization";

export class LocalizationAgent extends BaseAgent {
  constructor() {
    super("LOCALIZATION");
  }

  async execute(input: LocalizationInput): Promise<AgentResult<z.infer<typeof LocalizationOutputSchema>>> {
    const systemPrompt = `You are a cultural localization expert. You adapt content for different regional markets, not just translate. Always respond with valid JSON.`;

    const userPrompt = `Adapt the following content from ${input.sourceLocale} to multiple target locales:

SOURCE CONTENT:
- Platform: ${input.sourceContent.platform}
- Type: ${input.sourceContent.contentType}
- Caption: ${input.sourceContent.caption}
- Hashtags: ${input.sourceContent.hashtags.join(", ")}
${input.sourceContent.altText ? `- Alt text: ${input.sourceContent.altText}` : ""}

BRAND: ${input.brandConfig.brandName}
VOICE: ${input.brandConfig.voiceTone.adjectives.join(", ")}
THEMES: ${input.brandConfig.contentThemes.join(", ")}

TARGET LOCALES:
${input.localeConfigs.map((l) => `
${l.locale} (${l.displayName}):
- Language: ${l.language}
- Timezone: ${l.timezone}
- Cultural notes: ${l.culturalNotes}
- Forbidden topics: ${l.forbiddenTopics.join(", ")}
- Tone: ${l.toneAdjustment}
- Local hashtags: ${l.localHashtags.join(", ")}
- Currency: ${l.currencySymbol}
- Date format: ${l.dateFormat}
- Measurement: ${l.measurementSystem}
`).join("\n")}

LOCALIZATION RULES:
1. Translate naturally, not literally. Use local idioms.
2. Replace cultural references (sports, holidays, pop culture) with local equivalents.
3. Humor doesn't translate - adapt the mechanism.
4. Use trending hashtags in the TARGET locale.
5. Convert units (imperial/metric) and currency.
6. Use local date format.
7. Adjust emoji usage for cultural meaning.
8. Apply tone adjustment per locale.
9. Skip entirely if content is inappropriate for that market.

Respond with JSON:
{
  "localizations": [
    {
      "targetLocale": "en-GB",
      "caption": "adapted caption",
      "hashtags": ["local", "hashtags"],
      "mediaPrompt": "optional if visual needs changes",
      "altText": "optional",
      "adaptations": [
        {
          "type": "cultural_reference_swap|humor_adaptation|etc",
          "original": "what was changed",
          "adapted": "what it became",
          "reasoning": "why"
        }
      ],
      "warnings": ["any cultural sensitivities"],
      "skipRecommendation": false,
      "skipReason": "optional if skipping",
      "confidenceScore": 0.0-1.0
    }
  ],
  "overallConfidenceScore": 0.0-1.0
}`;

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    const parsed = this.parseJsonResponse(text);
    const validated = LocalizationOutputSchema.parse(parsed);

    const avgConfidence = validated.localizations.length > 0
      ? validated.localizations.reduce((sum, l) => sum + l.confidenceScore, 0) / validated.localizations.length
      : 0;

    const shouldEscalate = avgConfidence < 0.6 || validated.localizations.some((l) => l.skipRecommendation);

    return {
      success: true,
      data: validated,
      confidenceScore: validated.overallConfidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence (${avgConfidence.toFixed(2)}) or skip recommendations: ${validated.localizations.filter((l) => l.skipRecommendation).map((l) => l.targetLocale).join(", ")}`
        : undefined,
      tokensUsed,
    };
  }

  private parseJsonResponse(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
