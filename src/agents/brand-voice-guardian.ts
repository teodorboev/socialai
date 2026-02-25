import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { BrandVoiceGuardianSchema, BrandVoiceGuardianInputSchema, type BrandVoiceGuardianInput, type BrandVoiceGuardian } from "@/lib/ai/schemas/brand-voice-guardian";

export class BrandVoiceGuardianAgent extends BaseAgent {
  constructor() {
    super("BRAND_VOICE_GUARDIAN", "claude-sonnet-4-20250514");
  }

  async execute(input: BrandVoiceGuardianInput): Promise<AgentResult<BrandVoiceGuardian>> {
    const parsedInput = BrandVoiceGuardianInputSchema.parse(input);

    const systemPrompt = `You are a Brand Voice Guardian - an expert in maintaining consistent brand identity across all content.

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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze ${parsedInput.contentToAnalyze.length} content pieces for brand voice consistency for ${parsedInput.brandName}.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = BrandVoiceGuardianSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Escalate if there are major violations
    const hasMajorViolations = parsed.violations.some(v => v.severity === "major");
    const shouldEscalate = hasMajorViolations || parsed.confidenceScore < 0.5;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Major brand voice violations detected or low confidence (${parsed.confidenceScore})`
        : undefined,
      tokensUsed,
    };
  }
}
