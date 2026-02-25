import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  CrisisResponseSchema,
  CrisisResponseInputSchema,
  type CrisisResponseInput,
  type CrisisResponse,
} from "@/lib/ai/schemas/crisis-response";

export class CrisisResponseAgent extends BaseAgent {
  constructor() {
    super("CRISIS_RESPONSE", "claude-sonnet-4-20250514");
  }

  async execute(input: CrisisResponseInput): Promise<AgentResult<CrisisResponse>> {
    const parsedInput = CrisisResponseInputSchema.parse(input);

    const systemPrompt = `You are a Crisis Management Expert specializing in social media crisis response.

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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze this crisis situation for ${parsedInput.organizationId} and provide a comprehensive response strategy. Crisis type: ${parsedInput.crisisType}`,
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

    const parsed = CrisisResponseSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.escalationNeeded.required || parsed.severity === "CRITICAL" || parsed.severity === "HIGH";

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Crisis severity: ${parsed.severity}. Escalation ${parsed.escalationNeeded.required ? "required" : "recommended"} by agent.`
        : undefined,
      tokensUsed,
    };
  }
}
