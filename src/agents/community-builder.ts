import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import { CommunityBuilderSchema, CommunityBuilderInputSchema, type CommunityBuilderInput, type CommunityBuilder } from "@/lib/ai/schemas/community-builder";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CommunityBuilderAgent extends BaseAgent {
  constructor() {
    super("COMMUNITY_BUILDER");
    this.setTaskType("generation");
  }

  async execute(input: CommunityBuilderInput): Promise<AgentResult<CommunityBuilder>> {
    const parsedInput = CommunityBuilderInputSchema.parse(input);

    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("COMMUNITY_BUILDER", "main", {
        brandName: parsedInput.brandName,
        platforms: parsedInput.platforms.join(", "),
        communityData: JSON.stringify(parsedInput.communityData || {}),
      }, parsedInput.organizationId);
    } catch {
      // Fallback to inline prompt
      systemPrompt = `You are a Community Building Expert specializing in growing and engaging social communities.

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
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<CommunityBuilder>({
      system: systemPrompt,
      userMessage: `Build community strategy for ${parsedInput.brandName}.`,
      maxTokens: 2500,
      organizationId: parsedInput.organizationId,
      schema: CommunityBuilderSchema,
    });

    if (!data) {
      throw new Error("Failed to parse community builder response");
    }

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate: data.confidenceScore < 0.5 || data.communityHealth.engagement < 0.1,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
