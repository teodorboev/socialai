import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  CalendarOptimizerSchema,
  CalendarOptimizerInputSchema,
  type CalendarOptimizerInput,
  type CalendarOptimizer,
} from "@/lib/ai/schemas/calendar-optimizer";

export class CalendarOptimizerAgent extends BaseAgent {
  constructor() {
    super("CALENDAR_OPTIMIZER", "claude-sonnet-4-20250514");
  }

  async execute(input: CalendarOptimizerInput): Promise<AgentResult<CalendarOptimizer>> {
    const parsedInput = CalendarOptimizerInputSchema.parse(input);

    const systemPrompt = `You are a Social Media Calendar Optimization Expert specializing in determining optimal posting times and content strategies.

Your role is to analyze engagement data and audience behavior to recommend the best posting schedule.

CONTEXT:
- Optimizing posting schedule for ${parsedInput.organizationId}
- Current schedule needs to be improved based on data

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

CURRENT SCHEDULE:
${parsedInput.currentSchedule.map((s) => `- ${s.platform}: ${s.postsPerWeek}/week at ${s.postingTimes.join(", ")}`).join("\n")}

ENGAGEMENT DATA PERIOD: ${parsedInput.engagementData.period.start} to ${parsedInput.engagementData.period.end}

${parsedInput.audienceData ? `AUDIENCE INFO:
- Timezone: ${parsedInput.audienceData.timezone}
- Active Hours: ${parsedInput.audienceData.activeHours.map((h) => `${h.dayOfWeek} ${h.hourStart}-${h.hourEnd}: ${h.activity}`).join(", ")}
` : ""}

${parsedInput.businessConstraints ? `BUSINESS CONSTRAINTS:
- Manual posting available: ${parsedInput.businessConstraints.manualPostingAvailable ? "Yes" : "No"}
- Preferred times: ${parsedInput.businessConstraints.preferredTimes?.join(", ") || "None specified"}
- Blackout dates: ${parsedInput.businessConstraints.blackoutDates?.join(", ") || "None"}
` : ""}

INSTRUCTIONS:
1. Analyze engagement patterns by day and time
2. Identify best performing slots vs worst performing
3. Consider audience active hours in their timezone
4. Account for business constraints
5. Provide optimized schedule with rationale
6. Estimate expected improvements
7. Provide confidence score based on data quality

Respond with a JSON object matching this schema:
${JSON.stringify(CalendarOptimizerSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Optimize the posting schedule based on the engagement data and audience behavior.`,
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

    const parsed = CalendarOptimizerSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.confidenceScore < 0.6;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): Insufficient data to reliably optimize schedule`
        : undefined,
      tokensUsed,
    };
  }
}
