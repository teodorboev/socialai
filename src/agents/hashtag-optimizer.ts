import { BaseAgent, AgentResult, type OrgContext } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { HashtagOptimizerSchema, HashtagOptimizerInputSchema, type HashtagOptimizerInput, type HashtagOptimizer } from "@/lib/ai/schemas/hashtag-optimizer";

export class HashtagOptimizerAgent extends BaseAgent {
  constructor() {
    super("HASHTAG_OPTIMIZER", "claude-sonnet-4-20250514");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as HashtagOptimizerInput;
    const parsedInput = HashtagOptimizerInputSchema.parse(input);

    try {
      return await this.getPromptFromTemplate("main", {
        brandName: parsedInput.brandName,
        platform: parsedInput.platform,
        industry: parsedInput.industry,
        content: parsedInput.content,
        currentHashtags: parsedInput.currentHashtags ? JSON.stringify(parsedInput.currentHashtags) : "",
        competitorHashtags: parsedInput.competitorHashtags ? JSON.stringify(parsedInput.competitorHashtags) : "",
        goals: parsedInput.goals ? JSON.stringify(parsedInput.goals) : "",
      });
    } catch {
      return `You are a Hashtag Optimization Expert for social media.

Your role is to optimize hashtags for maximum reach and relevance.`;
    }
  }

  async execute(input: HashtagOptimizerInput): Promise<AgentResult<HashtagOptimizer>> {
    const parsedInput = HashtagOptimizerInputSchema.parse(input);

    const orgContext: OrgContext = input as unknown as OrgContext;
    const systemPrompt = await this.buildCachedPrompt(orgContext);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Optimize hashtags for ${parsedInput.brandName} on ${parsedInput.platform}.` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = HashtagOptimizerSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.5,
      tokensUsed,
    };
  }
}
