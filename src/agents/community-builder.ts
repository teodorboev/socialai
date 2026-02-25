import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { CommunityBuilderSchema, CommunityBuilderInputSchema, type CommunityBuilderInput, type CommunityBuilder } from "@/lib/ai/schemas/community-builder";

export class CommunityBuilderAgent extends BaseAgent {
  constructor() {
    super("COMMUNITY_BUILDER", "claude-sonnet-4-20250514");
  }

  async execute(input: CommunityBuilderInput): Promise<AgentResult<CommunityBuilder>> {
    const parsedInput = CommunityBuilderInputSchema.parse(input);

    const systemPrompt = `You are a Community Building Expert specializing in growing and engaging social communities.

Your role is to analyze the current community and develop strategies to build loyalty and advocacy.

BRAND: ${parsedInput.brandName}
PLATFORMS: ${parsedInput.platforms.join(", ")}

COMMUNITY DATA:
${JSON.stringify(parsedInput.communityData || {}, null, 2)}

ANALYSIS FRAMEWORK:
1. Assess community health (size, growth, engagement, sentiment)
2. Identify super fans and brand advocates
3. Segment community members by behavior
4. Develop community strategy and objectives
5. Create campaign ideas for engagement
6. Provide actionable recommendations

COMMUNITY TYPES:
- Lurkers: Read but rarely engage
- Contributors: Occasionally engage
- Super Fans: Highly engaged, create content, advocate
- Ambassadors: Official advocates, UGC creators

Respond with a JSON object matching this schema:
${JSON.stringify(CommunityBuilderSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Build community strategy for ${parsedInput.brandName}.` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = CommunityBuilderSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.5 || parsed.communityHealth.engagement < 0.1,
      tokensUsed,
    };
  }
}
