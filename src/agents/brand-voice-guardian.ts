import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { BrandVoiceGuardianSchema, BrandVoiceGuardianInputSchema, type BrandVoiceGuardianInput, type BrandVoiceGuardian } from "@/lib/ai/schemas/brand-voice-guardian";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class BrandVoiceGuardianAgent extends BaseAgent {
  constructor() {
    super("BRAND_VOICE_GUARDIAN");
    this.setTaskType("analysis");
  }

  async execute(input: BrandVoiceGuardianInput): Promise<AgentResult<BrandVoiceGuardian>> {
    const parsedInput = BrandVoiceGuardianInputSchema.parse(input);

    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("BRAND_VOICE_GUARDIAN", "main", {
        brandName: parsedInput.brandName,
        brandVoice: JSON.stringify(parsedInput.brandVoice),
        targetAudience: JSON.stringify(parsedInput.targetAudience || {}),
        contentCount: String(parsedInput.contentToAnalyze.length),
      }, parsedInput.organizationId);
    } catch {
      // Fallback to inline prompt
      systemPrompt = `You are a Brand Voice Guardian - an expert in maintaining consistent brand identity across all content.

Your role is to analyze content against the defined brand voice guidelines and ensure consistency.

BRAND: ${parsedInput.brandName}

BRAND VOICE PROFILE:
- Desired Tone Adjectives: ${parsedInput.brandVoice.adjectives.join(", ")}
- Example Content: ${parsedInput.brandVoice.examples.join(" | ")}
- Avoid: ${parsedInput.brandVoice.avoid.join(", ")}
- Mission: ${parsedInput.brandVoice.mission || "Not defined"}
- Values: ${parsedInput.brandVoice.values?.join(", ") || "Not defined"}

CONTENT TO ANALYZE:
${parsedInput.contentToAnalyze.map((c, i) => `${i + 1}. [${c.platform}/${c.type}]: "${c.caption.substring(0, 150)}..."`).join("\n")}

TARGET AUDIENCE:
${JSON.stringify(parsedInput.targetAudience || {}, null, 2)}

ANALYSIS FRAMEWORK:
1. Evaluate each piece of content against brand voice guidelines
2. Identify violations and their severity
3. Highlight strengths and alignment
4. Provide actionable recommendations
5. Create a brand voice profile analysis

VIOLATION TYPES:
- tone: Content doesn't match the desired emotional tone
- vocabulary: Uses words that should be avoided
- messaging: Doesn't align with brand mission/values
- audience: Not appropriate for target audience
- legal: Potential legal issues
- style: Formatting, length, or style issues

Respond with a JSON object matching this schema:
${JSON.stringify(BrandVoiceGuardianSchema.shape, null, 2)}`;
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<BrandVoiceGuardian>({
      system: systemPrompt,
      userMessage: `Analyze ${parsedInput.contentToAnalyze.length} content pieces for brand voice consistency for ${parsedInput.brandName}.`,
      maxTokens: 3000,
      organizationId: parsedInput.organizationId,
      schema: BrandVoiceGuardianSchema,
    });

    if (!data) {
      throw new Error("Failed to parse brand voice guardian response");
    }

    const shouldEscalate = data.confidenceScore < 0.5;

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${data.confidenceScore})`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
