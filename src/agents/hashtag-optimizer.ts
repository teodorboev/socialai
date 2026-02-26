import { BaseAgent, AgentResult, type OrgContext } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { HashtagOptimizerSchema, HashtagOptimizerInputSchema, type HashtagOptimizerInput, type HashtagOptimizer } from "@/lib/ai/schemas/hashtag-optimizer";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class HashtagOptimizerAgent extends BaseAgent {
  constructor() {
    super("HASHTAG_OPTIMIZER");
    this.setTaskType("classification");
  }

  async execute(input: HashtagOptimizerInput): Promise<AgentResult<HashtagOptimizer>> {
    const parsedInput = HashtagOptimizerInputSchema.parse(input);

    // Load prompt from DB
    const systemPrompt = await loadPrompt("HASHTAG_OPTIMIZER", "main", {
      brandName: parsedInput.brandName,
      platform: parsedInput.platform,
      industry: parsedInput.industry || "",
      content: parsedInput.content,
      currentHashtags: parsedInput.currentHashtags ? JSON.stringify(parsedInput.currentHashtags) : "",
      competitorHashtags: parsedInput.competitorHashtags ? JSON.stringify(parsedInput.competitorHashtags) : "",
      goals: parsedInput.goals ? JSON.stringify(parsedInput.goals) : "",
    }, parsedInput.organizationId);

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<HashtagOptimizer>({
      system: systemPrompt,
      userMessage: `Optimize hashtags for ${parsedInput.brandName} on ${parsedInput.platform}.`,
      maxTokens: 2000,
      organizationId: parsedInput.organizationId,
      schema: HashtagOptimizerSchema,
    });

    if (!data) {
      throw new Error("Failed to parse hashtag optimizer response");
    }

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate: data.confidenceScore < 0.5,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
