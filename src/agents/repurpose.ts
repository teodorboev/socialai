import { BaseAgent } from "./shared/base-agent";
import type { AgentResult } from "./shared/base-agent";
import { z } from "zod";
import { RepurposeOutputSchema, type RepurposeInput } from "@/lib/ai/schemas/repurpose";
import { buildRepurposePrompt } from "@/lib/ai/prompts/repurpose";

export class RepurposeAgent extends BaseAgent {
  constructor() {
    super("REPURPOSE");
  }

  async execute(input: RepurposeInput): Promise<AgentResult<z.infer<typeof RepurposeOutputSchema>>> {
    const systemPrompt = `You are an expert content repurposing specialist. You transform one piece of content into multiple platform-optimized formats. Always respond with valid JSON matching the required schema.`;

    const userPrompt = buildRepurposePrompt(input);

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: userPrompt,
      maxTokens: 4000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    const parsed = this.parseJsonResponse(text);
    const validated = RepurposeOutputSchema.parse(parsed);

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
      tokensUsed,
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
