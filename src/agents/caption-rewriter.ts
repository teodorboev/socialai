import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  CaptionRewriterSchema,
  CaptionRewriterInputSchema,
  type CaptionRewriterInput,
  type CaptionRewriter,
} from "@/lib/ai/schemas/caption-rewriter";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CaptionRewriterAgent extends BaseAgent {
  constructor() {
    super("CAPTION_REWRITER");
    this.setTaskType("generation");
  }

  async execute(input: CaptionRewriterInput): Promise<AgentResult<CaptionRewriter>> {
    const parsedInput = CaptionRewriterInputSchema.parse(input);

    // Load prompt from DB
    const systemPrompt = await loadPrompt("CAPTION_REWRITER", "main", {
      organizationId: parsedInput.organizationId,
      platform: parsedInput.platform,
      contentType: parsedInput.contentType,
      originalCaption: parsedInput.originalCaption,
      issues: JSON.stringify(parsedInput.issues),
      targetMetrics: JSON.stringify(parsedInput.targetMetrics),
      brandVoice: parsedInput.brandVoice ? JSON.stringify(parsedInput.brandVoice) : "",
      topPerformers: parsedInput.previousTopPerformers ? JSON.stringify(parsedInput.previousTopPerformers) : "",
    }, parsedInput.organizationId);

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<CaptionRewriter>({
      system: systemPrompt,
      userMessage: `Rewrite the following caption for ${parsedInput.platform} to improve performance:\n\n${parsedInput.originalCaption}`,
      maxTokens: 2500,
      organizationId: parsedInput.organizationId,
      schema: CaptionRewriterSchema,
    });

    if (!data) {
      throw new Error("Failed to parse caption rewriter response");
    }

    const shouldEscalate = data.confidenceScore < 0.65;

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${data.confidenceScore}): The rewrite may not adequately address all performance issues`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
