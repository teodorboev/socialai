import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  CrisisResponseSchema,
  CrisisResponseInputSchema,
  type CrisisResponseInput,
  type CrisisResponse,
} from "@/lib/ai/schemas/crisis-response";
import { loadPrompt } from "@/lib/ai/prompts/loader";

export class CrisisResponseAgent extends BaseAgent {
  constructor() {
    super("CRISIS_RESPONSE");
    this.setTaskType("reasoning");
  }

  async execute(input: CrisisResponseInput): Promise<AgentResult<CrisisResponse>> {
    const parsedInput = CrisisResponseInputSchema.parse(input);

    // Try to load prompt from DB first
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("CRISIS_RESPONSE", "main", {
        organizationId: parsedInput.organizationId,
        crisisType: parsedInput.crisisType,
        sentiment: JSON.stringify(parsedInput.sentiment),
        mentions: JSON.stringify(parsedInput.mentions.slice(0, 10)),
        affectedProducts: parsedInput.affectedProducts?.join(", ") || "",
        brandVoice: parsedInput.brandVoice ? JSON.stringify(parsedInput.brandVoice) : "",
      }, parsedInput.organizationId);
    } catch {
      // Fallback to inline prompt
      systemPrompt = `You are a Crisis Management Expert specializing in social media crisis response.

Your role is to assess crisis situations and provide strategic response plans to protect brand reputation.

CONTEXT:
- A potential crisis situation has been detected
- You need to assess severity and provide response strategies
- Speed and accuracy are critical in crisis management

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

CRISIS TYPE: ${parsedInput.crisisType}

SENTIMENT ANALYSIS:
- Overall: ${parsedInput.sentiment.overall}
- Trend: ${parsedInput.sentiment.trend}
- Volume: ${parsedInput.sentiment.volume} mentions

${parsedInput.mentions.length > 0 ? `RECENT MENTIONS:
${parsedInput.mentions.slice(0, 10).map((m) => `- ${m.platform} by ${m.author}: ${m.content.substring(0, 200)}...`).join("\n")}
` : ""}

${parsedInput.affectedProducts?.length ? `AFFECTED PRODUCTS: ${parsedInput.affectedProducts.join(", ")}` : ""}

${parsedInput.brandVoice ? `BRAND VALUES: ${parsedInput.brandVoice.values.join(", ")}
DO NOTS: ${parsedInput.brandVoice.doNots?.join(", ") || "None"}
` : ""}

INSTRUCTIONS:
1. Analyze the crisis type and mentions to assess severity
2. Determine if escalation to human team is required
3. Provide strategic response approach with appropriate tone
4. Create response templates for various scenarios
5. Recommend ongoing monitoring actions
6. Provide confidence score based on information available

Respond with a JSON object matching this schema:
${JSON.stringify(CrisisResponseSchema.shape, null, 2)}`;
    }

    const { data, tokensUsed, inputTokens, outputTokens } = await this.callLLM<CrisisResponse>({
      system: systemPrompt,
      userMessage: `Analyze this crisis situation for ${parsedInput.organizationId} and provide a comprehensive response strategy. Crisis type: ${parsedInput.crisisType}`,
      maxTokens: 3000,
      organizationId: parsedInput.organizationId,
      schema: CrisisResponseSchema,
    });

    if (!data) {
      throw new Error("Failed to parse crisis response");
    }

    const shouldEscalate = data.escalationNeeded.required;

    return {
      success: true,
      data,
      confidenceScore: data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Crisis requires escalation: ${data.escalationNeeded.reason}`
        : undefined,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}
