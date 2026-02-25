import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { HashtagOptimizerSchema, HashtagOptimizerInputSchema, type HashtagOptimizerInput, type HashtagOptimizer } from "@/lib/ai/schemas/hashtag-optimizer";

export class HashtagOptimizerAgent extends BaseAgent {
  constructor() {
    super("HASHTAG_OPTIMIZER", "claude-sonnet-4-20250514");
  }

  async execute(input: HashtagOptimizerInput): Promise<AgentResult<HashtagOptimizer>> {
    const parsedInput = HashtagOptimizerInputSchema.parse(input);

    const systemPrompt = `You are a Hashtag Optimization Expert for social media.

Your role is to optimize hashtags for maximum reach and relevance.

BRAND: ${parsedInput.brandName}
PLATFORM: ${parsedInput.platform}
INDUSTRY: ${parsedInput.industry}
CONTENT: "${parsedInput.content}"

CURRENT HASHTAGS: ${parsedInput.currentHashtags?.join(", ") || "None"}
COMPETITOR HASHTAGS: ${parsedInput.competitorHashtags?.join(", ") || "None"}
GOALS: ${parsedInput.goals?.join(", ") || "Engagement, Reach"}

ANALYSIS:
1. Research relevant hashtags by volume and competition
2. Create optimal mix of high/medium/niche/branded
3. Consider platform-specific best practices
4. Recommend hashtags to avoid

OPTIMAL MIX BY PLATFORM:
- Instagram: 3-5 high, 3-5 medium, 3-5 niche, 1-2 branded
- TikTok: 2-3 high, 2-3 medium, 2-3 niche, 1 branded
- Twitter: 1-2 high, 1-2 medium, 1-2 niche
- LinkedIn: 1-2 niche, 1-2 branded

Respond with a JSON object matching this schema:
${JSON.stringify(HashtagOptimizerSchema.shape, null, 2)}`;

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
