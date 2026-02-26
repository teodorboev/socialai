import { BaseAgent, AgentResult, type OrgContext } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  ChurnPredictionSchema,
  ChurnPredictionInputSchema,
  type ChurnPredictionInput,
  type ChurnPrediction,
} from "@/lib/ai/schemas/churn-prediction";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class ChurnPredictionAgent extends BaseAgent {
  constructor() {
    super("CHURN_PREDICTION");
    this.setTaskType("analysis");
  }

  async execute(input: ChurnPredictionInput): Promise<AgentResult<ChurnPrediction>> {
    const parsedInput = ChurnPredictionInputSchema.parse(input);

    // Load prompt from DB
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("CHURN_PREDICTION", "main", {
        organizationId: parsedInput.organizationId,
        usageData: JSON.stringify(parsedInput.usageData),
        engagementMetrics: parsedInput.engagementMetrics ? JSON.stringify(parsedInput.engagementMetrics) : "",
        billingHistory: JSON.stringify(parsedInput.billingHistory),
        accountData: JSON.stringify(parsedInput.accountData),
        comparableClients: parsedInput.comparableClients ? JSON.stringify(parsedInput.comparableClients) : "",
      }, parsedInput.organizationId);
    } catch {
      systemPrompt = `You are a Customer Retention Expert specializing in predicting churn risk and recommending retention strategies.

Your role is to analyze client behavior patterns and identify early warning signs of potential churn.`;
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<ChurnPrediction>({
      system: systemPrompt,
      userMessage: `Analyze churn risk for ${parsedInput.organizationId} and provide retention recommendations.`,
      maxTokens: 3000,
      organizationId: parsedInput.organizationId,
      schema: ChurnPredictionSchema,
    });

    if (!data) {
      throw new Error("Failed to parse churn prediction response");
    }

    const shouldEscalate = data.churnRisk.level === "CRITICAL" || data.churnRisk.level === "HIGH";

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `High churn risk detected: ${data.churnRisk.level}`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
