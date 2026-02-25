import type { RepurposeInput } from "../schemas/repurpose";

export function buildRepurposePrompt(input: RepurposeInput): string {
  return `You are a content repurposing expert for ${input.brandConfig.brandName}.

Your job is to take ONE piece of source content and create MULTIPLE unique, 
platform-optimized outputs. Each output must:

1. Stand alone — someone who never saw the original should understand it
2. Feel native to the target platform (not like a copy-paste)
3. Match the brand voice exactly
4. Have a unique hook — don't use the same opening across platforms
5. Be a DIFFERENT ANGLE or SLICE of the source — not the same content reformatted

SOURCE CONTENT:
- Type: ${input.sourceType}
- Title: ${input.sourceContent.title || "N/A"}
- Body: ${input.sourceContent.body.substring(0, 2000)}
${input.sourceContent.url ? `- URL: ${input.sourceContent.url}` : ""}
${input.sourceContent.platform ? `- Source Platform: ${input.sourceContent.platform}` : ""}
${input.sourceContent.engagementData ? `- Engagement: ${input.sourceContent.engagementData.engagementRate}% ER, ${input.sourceContent.engagementData.topMetric} was top metric` : ""}

TARGET PLATFORMS: ${input.targetPlatforms.join(", ")}
${input.excludeFormats ? `- Excluded formats: ${input.excludeFormats.join(", ")}` : ""}

BRAND VOICE:
- Adjectives: ${input.brandConfig.voiceTone.adjectives.join(", ")}
- Examples: ${input.brandConfig.voiceTone.examples.join(" | ")}
- Avoid: ${input.brandConfig.voiceTone.avoid.join(", ")}

CONTENT THEMES: ${input.brandConfig.contentThemes.join(", ")}

REPURPOSING STRATEGIES BY PLATFORM:
- Instagram: Pull the most visual/emotional angle. Carousels for educational content, Reels for storytelling.
- Twitter/X: Extract hot takes, statistics, or counterintuitive insights. Thread for depth.
- LinkedIn: Professional angle, lessons learned, industry implications. Personal narrative tone.
- TikTok: Most entertaining/surprising element. Hook in 2 seconds. Conversational script.
- Facebook: Community-oriented angle. Questions that spark discussion.

FROM HIGH-PERFORMING POSTS:
- Identify WHY it performed well (the hook? the topic? the format?)
- Replicate the winning element in a different format for other platforms
- Create a "part 2" or "deeper dive" variant for the same platform
- Do NOT simply copy — transform the angle

Respond with JSON:
{
  "sourceAnalysis": {
    "keyMessages": ["1-5 key messages extracted"],
    "targetAudience": "who this content resonates with",
    "bestAngles": ["angles worth exploring"],
    "contentPillars": ["content pillars this fits into"]
  },
  "outputs": [
    {
      "platform": "Instagram|Twitter|TikTok|LinkedIn|Facebook",
      "contentType": "POST|STORY|REEL|CAROUSEL|THREAD|ARTICLE|POLL",
      "caption": "the full caption",
      "hashtags": ["relevant", "hashtags"],
      "mediaPrompt": "optional prompt for image generation",
      "altText": "optional alt text",
      "hook": "attention-grabbing first line",
      "adaptationNotes": "what changed and why",
      "confidenceScore": 0.0-1.0
    }
  ],
  "contentCalendarSuggestion": [
    {
      "outputIndex": 0,
      "suggestedDay": "Monday|Tuesday|...",
      "suggestedTime": "morning|afternoon|evening",
      "reasoning": "why this timing"
    }
  ],
  "overallConfidenceScore": 0.0-1.0
}`;
}
