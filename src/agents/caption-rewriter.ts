import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  CaptionRewriterSchema,
  CaptionRewriterInputSchema,
  type CaptionRewriterInput,
  type CaptionRewriter,
} from "@/lib/ai/schemas/caption-rewriter";

export class CaptionRewriterAgent extends BaseAgent {
  constructor() {
    super("CAPTION_REWRITER", "claude-sonnet-4-20250514");
  }

  async execute(input: CaptionRewriterInput): Promise<AgentResult<CaptionRewriter>> {
    const parsedInput = CaptionRewriterInputSchema.parse(input);

    const systemPrompt = `You are an expert social media copywriter specializing in content optimization.

Your role is to analyze underperforming content and rewrite it to improve engagement metrics.

CONTEXT:
- Original content did not meet performance expectations
- You need to identify issues and create improved copy
- Maintain brand voice while optimizing for better results
- Platform: ${parsedInput.platform}
- Content Type: ${parsedInput.contentType}

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

ISSUES TO ADDRESS:
${parsedInput.issues.map((issue) => `- ${issue}`).join("\n")}

TARGET METRICS:
- Primary Goal: ${parsedInput.targetMetrics.primaryGoal}
- Current: ${JSON.stringify(parsedInput.targetMetrics.currentMetrics || "N/A", null, 2)}

${parsedInput.brandVoice ? `BRAND VOICE:
- Tone: ${parsedInput.brandVoice.tone.join(", ")}
- Do Nots: ${parsedInput.brandVoice.doNots?.join(", ") || "None"}
` : ""}

${parsedInput.previousTopPerformers?.length ? `TOP PERFORMERS TO REFERENCE:
${parsedInput.previousTopPerformers.map((p) => `- ${p.caption} (metrics: ${JSON.stringify(p.metrics)})`).join("\n")}
` : ""}

INSTRUCTIONS:
1. Analyze the original caption and identify what caused poor performance
2. Rewrite the caption addressing all identified issues
3. Make changes that align with brand voice
4. Ensure the rewrite targets the specified metrics
5. Provide confidence score (0-1) based on how well the rewrite addresses issues

Respond with a JSON object matching this schema:
${JSON.stringify(CaptionRewriterSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Rewrite the following caption for ${parsedInput.platform} to improve performance:\n\n${parsedInput.originalCaption}`,
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

    const parsed = CaptionRewriterSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.confidenceScore < 0.65;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): The rewrite may not adequately address all performance issues`
        : undefined,
      tokensUsed,
    };
  }
}
