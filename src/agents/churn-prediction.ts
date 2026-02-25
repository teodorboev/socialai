import { BaseAgent, AgentResult } from "./shared/base-agent";
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

  async execute(input: ChurnPredictionInput): Promise<AgentResult<ChurnPrediction>> {
    const parsedInput = ChurnPredictionInputSchema.parse(input);

    const systemPrompt = `You are a Customer Retention Expert specializing in predicting churn risk and recommending retention strategies.

Your role is to analyze client behavior patterns and identify early warning signs of potential churn.

CONTEXT:
- Analyzing churn risk for ${parsedInput.organizationId}
- Goal: Identify at-risk clients and recommend proactive retention actions

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

USAGE PATTERNS:
- Last 30 days:
  - Logins: ${parsedInput.usageData.last30Days.logins}
  - Features used: ${parsedInput.usageData.last30Days.featuresUsed}
  - Content generated: ${parsedInput.usageData.last30Days.contentGenerated}
  - Posts published: ${parsedInput.usageData.last30Days.postsPublished}
- Last active: ${parsedInput.usageData.lastActiveDate}
- Trend: ${parsedInput.usageData.trend}

${parsedInput.engagementMetrics ? `PLATFORM ENGAGEMENT:
- Email open rate: ${parsedInput.engagementMetrics.emailOpenRate || "N/A"}
- Report view rate: ${parsedInput.engagementMetrics.reportViewRate || "N/A"}
- Support tickets: ${parsedInput.engagementMetrics.supportTickets?.count || 0}
- NPS: ${parsedInput.engagementMetrics.npsScore || "N/A"}
` : ""}

BILLING INFO:
- Current plan: ${parsedInput.billingHistory.plan}
- Months on plan: ${parsedInput.billingHistory.monthsOnPlan}
- Outstanding balance: ${parsedInput.billingHistory.outstandingBalance || 0}

${parsedInput.billingHistory.planChanges.length > 0 ? `PLAN CHANGES:
${parsedInput.billingHistory.planChanges.map((c) => `- ${c.date}: ${c.from} → ${c.to} (${c.direction})`).join("\n")}
` : ""}

${parsedInput.billingHistory.paymentIssues.length > 0 ? `PAYMENT ISSUES:
${parsedInput.billingHistory.paymentIssues.map((i) => `- ${i.date}: ${i.type} (Resolved: ${i.resolved})`).join("\n")}
` : ""}

ACCOUNT DETAILS:
- Team size: ${parsedInput.accountData.teamSize}
- Social accounts: ${parsedInput.accountData.socialAccountsConnected}
- Months as customer: ${parsedInput.accountData.monthsAsCustomer}
- Onboarding completed: ${parsedInput.accountData.onboardingCompleted ? "Yes" : "No"}

${parsedInput.comparableClients?.length ? `COMPARABLE CLIENTS:
${parsedInput.comparableClients.slice(0, 10).map((c) => `- Outcome: ${c.outcome}, Tenure: ${c.tenure} months, Plan: ${c.plan}`).join("\n")}
` : ""}

INSTRUCTIONS:
1. Analyze usage patterns and engagement metrics
2. Identify risk factors contributing to churn probability
3. Compare to similar clients who stayed or churned
4. Recommend specific retention actions with priority
5. Identify early warning signs to monitor
6. Provide confidence score based on data quality

Respond with a JSON object matching this schema:
${JSON.stringify(ChurnPredictionSchema.shape, null, 2)}`;

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
