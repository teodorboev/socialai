import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  AdCopySchema,
  AdCopyInputSchema,
  type AdCopyInput,
  type AdCopy,
} from "@/lib/ai/schemas/ad-copy";

export class AdCopyAgent extends BaseAgent {
  constructor() {
    super("AD_COPY", "claude-sonnet-4-20250514");
  }

  async execute(input: AdCopyInput): Promise<AgentResult<AdCopy>> {
    const parsedInput = AdCopyInputSchema.parse(input);

    const systemPrompt = `You are a Paid Social Advertising Expert specializing in creating high-converting ad copy and targeting strategies.

Your role is to generate compelling ad variations, recommend targeting, and optimize budget allocation for paid social campaigns.

CONTEXT:
- Creating ads for ${parsedInput.platform}
- Campaign Objective: ${parsedInput.campaignObjective}
- Budget: $${parsedInput.budget.totalBudget} total over ${parsedInput.budget.duration} weeks

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

PRODUCT:
- Name: ${parsedInput.product.name}
- Description: ${parsedInput.product.description}
- Category: ${parsedInput.product.category}
- Price: ${parsedInput.product.price ? `$${parsedInput.product.price}` : "N/A"}
- USPs: ${parsedInput.product.USPs.join(", ")}

TARGET AUDIENCE:
${JSON.stringify(parsedInput.targetAudience, null, 2)}

${parsedInput.brandVoice ? `BRAND VOICE:
- Tone: ${parsedInput.brandVoice.tone.join(", ")}
- Do Nots: ${parsedInput.brandVoice.doNots?.join(", ") || "None"}
` : ""}

${parsedInput.previousAds?.length ? `PREVIOUS AD PERFORMANCE:
${parsedInput.previousAds.map((ad) => `- Platform: ${ad.platform}, CTR: ${ad.performance.ctr}, ROAS: ${ad.performance.roas}\n  Worked: ${ad.whatWorked?.join(", ")}\n  Didn't Work: ${ad.whatDidntWork?.join(", ")}`).join("\n\n")}
` : ""}

INSTRUCTIONS:
1. Create multiple ad copy variations (headlines, descriptions, CTAs)
2. Recommend targeting criteria based on the audience definition
3. Provide budget allocation and bid strategy recommendations
4. Estimate expected ROI based on industry benchmarks
5. Include creative asset specifications
6. Provide confidence score based on how well the ads match best practices

Respond with a JSON object matching this schema:
${JSON.stringify(AdCopySchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create ad copy and targeting strategy for ${parsedInput.product.name} on ${parsedInput.platform}.`,
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

    const parsed = AdCopySchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.confidenceScore < 0.65;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): Ad copy may not adequately target the intended audience`
        : undefined,
      tokensUsed,
    };
  }
}
