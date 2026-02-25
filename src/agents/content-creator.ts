import { z } from "zod";
import { BaseAgent, type AgentResult } from "./shared/base-agent";
import type { AgentName, Platform, ContentType, MediaType } from "@prisma/client";

const ContentOutputSchema = z.object({
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string()),
  contentType: z.enum(["POST", "STORY", "REEL", "CAROUSEL", "THREAD", "ARTICLE", "POLL"]),
  mediaPrompt: z.string().optional().describe("Prompt for image/video generation if visual content is needed"),
  altText: z.string().optional(),
  platformNotes: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string(),
});

type ContentOutput = z.infer<typeof ContentOutputSchema>;

export interface ContentCreatorInput {
  organizationId: string;
  platform: Platform;
  brandConfig: {
    brandName: string;
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    contentThemes: string[];
    doNots: string[];
    targetAudience: {
      demographics?: string;
      interests?: string[];
      painPoints?: string[];
    };
    hashtagStrategy?: {
      always?: string[];
      never?: string[];
      rotating?: string[];
    };
  };
  contentPlanContext?: string;
  trendContext?: string;
  previousTopPerformers?: Array<{
    caption: string;
    engagementRate: number;
  }>;
  // DNA Profile context
  dnaContext?: {
    recommendedHooks: string[];
    recommendedTopics: string[];
    recommendedAngles: string[];
    recommendedDays: number[];
    recommendedHours: number[];
    avoidHooks: string[];
    avoidTopics: string[];
    avoidAngles: string[];
    stats: {
      totalPosts: number;
      hitRate: number;
      avgEngagement: number;
    };
  };
}

export class ContentCreatorAgent extends BaseAgent {
  constructor() {
    super("CONTENT_CREATOR");
  }

  async execute(input: ContentCreatorInput): Promise<AgentResult<ContentOutput>> {
    const systemPrompt = this.buildSystemPrompt(input);
    const userMessage = this.buildUserMessage(input);

    try {
      const { text, tokensUsed } = await this.callClaude({
        system: systemPrompt,
        userMessage,
        maxTokens: 2000,
      });

      const parsed = this.parseResponse(text);
      const shouldEscalate = parsed.confidenceScore < 0.75;

      return {
        success: true,
        data: parsed,
        confidenceScore: parsed.confidenceScore,
        shouldEscalate,
        escalationReason: shouldEscalate
          ? `Content confidence too low (${parsed.confidenceScore}): ${parsed.reasoning}`
          : undefined,
        tokensUsed,
      };
    } catch (error) {
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: error instanceof Error ? error.message : "Unknown error",
        tokensUsed: 0,
      };
    }
  }

  private buildSystemPrompt(input: ContentCreatorInput): string {
    const {
      brandName,
      voiceTone,
      contentThemes,
      doNots,
      targetAudience,
      hashtagStrategy,
    } = input.brandConfig;

    const dnaSection = input.dnaContext ? `
DNA WINNING PATTERNS (engineer content matching these formulas):
Based on ${input.dnaContext.stats.totalPosts} posts analyzed:
- Historical hit rate: ${(input.dnaContext.stats.hitRate * 100).toFixed(1)}%
- Average engagement: ${(input.dnaContext.stats.avgEngagement * 100).toFixed(1)}%

WINNING COMBINATIONS (prioritize these):
${input.dnaContext.recommendedHooks.length ? `- Hooks that worked: ${input.dnaContext.recommendedHooks.join(", ")}` : ""}
${input.dnaContext.recommendedTopics.length ? `- Topics that resonated: ${input.dnaContext.recommendedTopics.join(", ")}` : ""}
${input.dnaContext.recommendedAngles.length ? `- Angles that engaged: ${input.dnaContext.recommendedAngles.join(", ")}` : ""}

AVOID (overused - high fatigue):
${input.dnaContext.avoidHooks.length ? `- Hooks: ${input.dnaContext.avoidHooks.join(", ")}` : ""}
${input.dnaContext.avoidTopics.length ? `- Topics: ${input.dnaContext.avoidTopics.join(", ")}` : ""}
${input.dnaContext.avoidAngles.length ? `- Angles: ${input.dnaContext.avoidAngles.join(", ")}` : ""}

BEST POSTING TIMES:
${input.dnaContext.recommendedDays.length ? `- Days: ${input.dnaContext.recommendedDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}` : ""}
${input.dnaContext.recommendedHours.length ? `- Hours: ${input.dnaContext.recommendedHours.join(", ")}` : ""}
` : "";

    return `You are an expert social media content creator for ${brandName}.

BRAND VOICE:
- Adjectives: ${voiceTone.adjectives.join(", ")}
- Examples of on-brand content:
${voiceTone.examples.map((e) => `- ${e}`).join("\n")}
- Things to avoid:
${voiceTone.avoid.map((a) => `- ${a}`).join("\n")}

TARGET AUDIENCE:
${targetAudience.demographics ? `- Demographics: ${targetAudience.demographics}` : ""}
${targetAudience.interests ? `- Interests: ${targetAudience.interests.join(", ")}` : ""}
${targetAudience.painPoints ? `- Pain points: ${targetAudience.painPoints.join(", ")}` : ""}

CONTENT THEMES: ${contentThemes.join(", ")}

THINGS TO NEVER DO OR SAY:
${doNots.map((d) => `- ${d}`).join("\n")}

HASHTAG STRATEGY:
${hashtagStrategy ? `
- Always use: ${hashtagStrategy.always?.join(", ") || "none"}
- Never use: ${hashtagStrategy.never?.join(", ") || "none"}
- Rotate through: ${hashtagStrategy.rotating?.join(", ") || "none"}
` : "Use relevant hashtags from your knowledge."}

PLATFORM: ${input.platform}
${dnaSection}
${input.contentPlanContext ? `CURRENT CONTENT PLAN CONTEXT:\n${input.contentPlanContext}` : ""}

${input.trendContext ? `TRENDING TOPICS TO CONSIDER:\n${input.trendContext}` : ""}

${input.previousTopPerformers?.length ? `TOP PERFORMING CONTENT (use as inspiration for style/format):\n${input.previousTopPerformers.map((p) => `- ${p.caption} (${p.engagementRate}% engagement)`).join("\n")}` : ""}

INSTRUCTIONS:
1. Create ONE piece of content for ${input.platform} that is on-brand, engaging, and optimized for the platform.
2. Match the brand voice exactly. The content should sound like it was written by the brand, not by AI.
3. If DNA patterns are provided, engineer content that matches the winning combinations while varying from the avoid list.
4. Include relevant hashtags based on the strategy.
5. If visual content would enhance the post, include a detailed media prompt.
6. Rate your confidence (0-1) in how well this matches the brand voice and will perform.
7. Provide brief reasoning for your choices.

Respond with a JSON object matching this schema exactly.`;
  }

  private buildUserMessage(input: ContentCreatorInput): string {
    const today = new Date().toISOString().split("T")[0];
    return `Create a new ${input.platform} post. Make it authentic, engaging, and true to the brand voice. Today is ${today}.`;
  }

  private parseResponse(text: string): ContentOutput {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return ContentOutputSchema.parse(parsed);
  }
}
