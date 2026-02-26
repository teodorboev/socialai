import { BaseAgent, type AgentResult, type OrgContext } from "./shared/base-agent";
import { z } from "zod";
import { RepurposeOutputSchema, type RepurposeInput } from "@/lib/ai/schemas/repurpose";
import { buildRepurposePrompt } from "@/lib/ai/prompts/repurpose";

export class RepurposeAgent extends BaseAgent {
  constructor() {
    super("REPURPOSE");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as RepurposeInput;

    try {
      return await this.getPromptFromTemplate("main", {
        organizationId: input.organizationId,
        brandName: input.brandConfig.brandName,
        sourceType: input.sourceType,
        sourceContent: JSON.stringify(input.sourceContent),
        targetPlatforms: JSON.stringify(input.targetPlatforms),
        excludeFormats: input.excludeFormats ? JSON.stringify(input.excludeFormats) : "",
      });
    } catch {
      return `You are an expert content repurposing specialist. You transform one piece of content into multiple platform-optimized formats. Always respond with valid JSON matching the required schema.`;
    }
  }

  async execute(input: RepurposeInput): Promise<AgentResult<z.infer<typeof RepurposeOutputSchema>>> {
    const orgContext: OrgContext = input as unknown as OrgContext;
    const cachedBlocks = await this.buildCachedPrompt(orgContext);
    const systemPrompt = cachedBlocks.map(b => b.text).join("\n\n");
    const userPrompt = buildRepurposePrompt(input);

    const result = await this.callLLM<z.infer<typeof RepurposeOutputSchema>>({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
      schema: RepurposeOutputSchema,
    });

    if (!result.data) {
      throw new Error("No structured data returned from LLM");
    }

    const validated = result.data;

    // Calculate overall confidence as average of output confidences
    const avgConfidence = validated.outputs.length > 0
      ? validated.outputs.reduce((sum, o) => sum + o.confidenceScore, 0) / validated.outputs.length
      : 0;

    const shouldEscalate = avgConfidence < 0.6 || validated.outputs.length === 0;

    return {
      success: true,
      data: validated,
      confidenceScore: validated.overallConfidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence (${avgConfidence.toFixed(2)}) or no outputs generated`
        : undefined,
      tokensUsed: result.tokensUsed,
    };
  }

  private parseJsonResponse(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  }
}
