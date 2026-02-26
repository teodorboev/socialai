import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  AdCopySchema,
  AdCopyInputSchema,
  type AdCopyInput,
  type AdCopy,
} from "@/lib/ai/schemas/ad-copy";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class AdCopyAgent extends BaseAgent {
  constructor() {
    super("AD_COPY");
    this.setTaskType("generation");
  }

  async execute(input: AdCopyInput): Promise<AgentResult<AdCopy>> {
    const parsedInput = AdCopyInputSchema.parse(input);

    // Load system prompt from DB
    const systemPrompt = await loadPrompt("AD_COPY", "main", {
      platform: parsedInput.platform,
      campaignObjective: parsedInput.campaignObjective,
      budget: String(parsedInput.budget.totalBudget),
      duration: String(parsedInput.budget.duration),
      productName: parsedInput.product.name,
      productDescription: parsedInput.product.description,
      productCategory: parsedInput.product.category,
      productPrice: parsedInput.product.price ? String(parsedInput.product.price) : "N/A",
      usps: parsedInput.product.USPs.join(", "),
      targetAudience: JSON.stringify(parsedInput.targetAudience),
      brandVoice: parsedInput.brandVoice ? JSON.stringify(parsedInput.brandVoice) : "",
    }, parsedInput.organizationId);

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<AdCopy>({
      system: systemPrompt,
      userMessage: `Create ad copy and targeting strategy for ${parsedInput.product.name} on ${parsedInput.platform}.`,
      maxTokens: 3500,
      organizationId: parsedInput.organizationId,
      schema: AdCopySchema,
    });

    if (!data) {
      throw new Error("Failed to parse ad copy response");
    }

    const shouldEscalate = data.confidenceScore < 0.65;

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${data.confidenceScore}): Ad copy may not adequately target the intended audience`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
