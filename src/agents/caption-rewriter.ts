import { BaseAgent, AgentResult, type OrgContext } from "./shared/base-agent";
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

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as CaptionRewriterInput;
    const parsedInput = CaptionRewriterInputSchema.parse(input);

    try {
      return await this.getPromptFromTemplate("main", {
        organizationId: parsedInput.organizationId,
        platform: parsedInput.platform,
        contentType: parsedInput.contentType,
        originalCaption: parsedInput.originalCaption,
        issues: JSON.stringify(parsedInput.issues),
        targetMetrics: JSON.stringify(parsedInput.targetMetrics),
        brandVoice: parsedInput.brandVoice ? JSON.stringify(parsedInput.brandVoice) : "",
        topPerformers: parsedInput.previousTopPerformers ? JSON.stringify(parsedInput.previousTopPerformers) : "",
      });
    } catch {
      return `You are an expert social media copywriter specializing in content optimization.

Your role is to analyze underperforming content and rewrite it to improve engagement metrics.`;
    }
  }

  async execute(input: CaptionRewriterInput): Promise<AgentResult<CaptionRewriter>> {
    const parsedInput = CaptionRewriterInputSchema.parse(input);

    const orgContext: OrgContext = input as unknown as OrgContext;
    const systemPrompt = await this.buildCachedPrompt(orgContext);

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
