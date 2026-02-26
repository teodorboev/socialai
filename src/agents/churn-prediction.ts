import { BaseAgent, AgentResult, type OrgContext } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  ChurnPredictionSchema,
  ChurnPredictionInputSchema,
  type ChurnPredictionInput,
  type ChurnPrediction,
} from "@/lib/ai/schemas/churn-prediction";

export class ChurnPredictionAgent extends BaseAgent {
  constructor() {
    super("CHURN_PREDICTION", "claude-sonnet-4-20250514");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as ChurnPredictionInput;
    const parsedInput = ChurnPredictionInputSchema.parse(input);

    try {
      return await this.getPromptFromTemplate("main", {
        organizationId: parsedInput.organizationId,
        usageData: JSON.stringify(parsedInput.usageData),
        engagementMetrics: parsedInput.engagementMetrics ? JSON.stringify(parsedInput.engagementMetrics) : "",
        billingHistory: JSON.stringify(parsedInput.billingHistory),
        accountData: JSON.stringify(parsedInput.accountData),
        comparableClients: parsedInput.comparableClients ? JSON.stringify(parsedInput.comparableClients) : "",
      });
    } catch {
      return `You are a Customer Retention Expert specializing in predicting churn risk and recommending retention strategies.

Your role is to analyze client behavior patterns and identify early warning signs of potential churn.`;
    }
  }

  async execute(input: ChurnPredictionInput): Promise<AgentResult<ChurnPrediction>> {
    const parsedInput = ChurnPredictionInputSchema.parse(input);

    const orgContext: OrgContext = input as unknown as OrgContext;
    const systemPrompt = await this.buildCachedPrompt(orgContext);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze churn risk for ${parsedInput.organizationId} and provide retention recommendations.`,
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

    const parsed = ChurnPredictionSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.churnRisk.level === "CRITICAL" || parsed.churnRisk.level === "HIGH";

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `High churn risk detected: ${parsed.churnRisk.level} risk level with ${parsed.churnRisk.score} score`
        : undefined,
      tokensUsed,
    };
  }
}
