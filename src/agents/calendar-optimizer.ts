import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  CalendarOptimizerSchema,
  CalendarOptimizerInputSchema,
  type CalendarOptimizerInput,
  type CalendarOptimizer,
} from "@/lib/ai/schemas/calendar-optimizer";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CalendarOptimizerAgent extends BaseAgent {
  constructor() {
    super("CALENDAR_OPTIMIZER");
    this.setTaskType("analysis");
  }

  async execute(input: CalendarOptimizerInput): Promise<AgentResult<CalendarOptimizer>> {
    const parsedInput = CalendarOptimizerInputSchema.parse(input);

    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("CALENDAR_OPTIMIZER", "main", {
        organizationId: parsedInput.organizationId,
        currentSchedule: JSON.stringify(parsedInput.currentSchedule),
        engagementData: JSON.stringify(parsedInput.engagementData),
        audienceData: parsedInput.audienceData ? JSON.stringify(parsedInput.audienceData) : "",
        businessConstraints: parsedInput.businessConstraints ? JSON.stringify(parsedInput.businessConstraints) : "",
      }, parsedInput.organizationId);
    } catch {
      // Fallback to inline prompt
      systemPrompt = `You are a Social Media Calendar Optimization Expert specializing in determining optimal posting times and content strategies.

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
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<CalendarOptimizer>({
      system: systemPrompt,
      userMessage: `Optimize the posting schedule based on the engagement data and audience behavior.`,
      maxTokens: 3000,
      organizationId: parsedInput.organizationId,
      schema: CalendarOptimizerSchema,
    });

    if (!data) {
      throw new Error("Failed to parse calendar optimizer response");
    }

    const shouldEscalate = data.confidenceScore < 0.5;

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${data.confidenceScore})`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
