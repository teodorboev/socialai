import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  ReportingNarratorSchema,
  ReportingNarratorInputSchema,
  type ReportingNarratorInput,
  type ReportingNarrator,
} from "@/lib/ai/schemas/reporting-narrator";

export class ReportingNarratorAgent extends BaseAgent {
  constructor() {
    super("REPORTING_NARRATOR", "claude-sonnet-4-20250514");
  }

  async execute(input: ReportingNarratorInput): Promise<AgentResult<ReportingNarrator>> {
    const parsedInput = ReportingNarratorInputSchema.parse(input);

    const systemPrompt = `You are a Data Storytelling Expert specializing in transforming analytics data into compelling narrative reports.

Your role is to take raw metrics data and create a cohesive, actionable narrative that stakeholders can understand and act upon.

CONTEXT:
- Creating a ${parsedInput.period.type} report for ${parsedInput.organizationId}
- Period: ${parsedInput.period.start} to ${parsedInput.period.end}
- Report audience: ${parsedInput.reportAudience}

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

METRICS OVERVIEW:
- Total Posts: ${parsedInput.metrics.overview.totalPosts}
- Total Engagement: ${parsedInput.metrics.overview.totalEngagement}
- Total Reach: ${parsedInput.metrics.overview.totalReach}
- Followers: ${parsedInput.metrics.overview.totalFollowers} (${parsedInput.metrics.overview.followerChange > 0 ? "+" : ""}${parsedInput.metrics.overview.followerChange})
- Engagement Rate: ${parsedInput.metrics.overview.engagementRate}%

PLATFORM BREAKDOWN:
${Object.entries(parsedInput.metrics.byPlatform).map(([platform, data]) => 
  `- ${platform}: ${data.posts} posts, ${data.engagement} engagement, ${data.followerChange > 0 ? "+" : ""}${data.followerChange} followers`
).join("\n")}

${parsedInput.metrics.topContent.length > 0 ? `TOP CONTENT:
${parsedInput.metrics.topContent.slice(0, 5).map((c) => `- ${c.platform} ${c.type}: ${c.engagement} engagement`).join("\n")}
` : ""}

${parsedInput.goals?.length ? `GOALS:
${parsedInput.goals.map((g) => `- ${g.metric}: ${g.actual}/${g.target} (${g.achieved ? "Achieved" : "Missed"})`).join("\n")}
` : ""}

${parsedInput.previousPeriodData ? `COMPARISON TO PREVIOUS PERIOD:
- Engagement: ${parsedInput.previousPeriodData.engagement}
- Reach: ${parsedInput.previousPeriodData.reach}
- Followers: ${parsedInput.previousPeriodData.followers}
` : ""}

INSTRUCTIONS:
1. Create a cohesive narrative that tells the story of performance
2. Highlight key wins and successes
3. Address concerns and areas for improvement
4. Provide actionable recommendations based on the data
5. Compare to previous periods and goals
6. Match tone to the audience (CLIENT, INTERNAL, EXECUTIVE)
7. Provide confidence score based on data completeness

Respond with a JSON object matching this schema:
${JSON.stringify(ReportingNarratorSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create a ${parsedInput.period.type.toLowerCase()} performance report narrative for ${parsedInput.reportAudience.toLowerCase()} audience.`,
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

    const parsed = ReportingNarratorSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.confidenceScore < 0.6;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): Report may lack sufficient data for accurate analysis`
        : undefined,
      tokensUsed,
    };
  }
}
