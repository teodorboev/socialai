import { BaseAgent, AgentResult } from "./shared/base-agent";
import { AgentName } from "@prisma/client";
import { z } from "zod";
import {
  OnboardingIntelligenceSchema,
  OnboardingIntelligenceInputSchema,
  type OnboardingIntelligenceInput,
  type OnboardingIntelligence,
} from "@/lib/ai/schemas/onboarding-intelligence";

export class OnboardingIntelligenceAgent extends BaseAgent {
  constructor() {
    super("ONBOARDING_INTELLIGENCE", "claude-sonnet-4-20250514");
  }

  async execute(input: OnboardingIntelligenceInput): Promise<AgentResult<OnboardingIntelligence>> {
    const parsedInput = OnboardingIntelligenceInputSchema.parse(input);

    const systemPrompt = `You are a Client Onboarding Expert specializing in creating personalized onboarding experiences for new social media management clients.

Your role is to design an onboarding plan that sets new clients up for success based on their specific needs, goals, and resources.

CONTEXT:
- New client onboarding for ${parsedInput.clientInfo.companyName}
- Industry: ${parsedInput.clientInfo.industry}
- Company Size: ${parsedInput.clientInfo.companySize}

INPUT DATA:
${JSON.stringify(parsedInput, null, 2)}

CLIENT INFO:
- Company: ${parsedInput.clientInfo.companyName}
- Industry: ${parsedInput.clientInfo.industry}
- Size: ${parsedInput.clientInfo.companySize}
${parsedInput.clientInfo.website ? `- Website: ${parsedInput.clientInfo.website}` : ""}

${parsedInput.clientInfo.existingSocialAccounts?.length ? `EXISTING SOCIAL ACCOUNTS:
${parsedInput.clientInfo.existingSocialAccounts.map((a) => `- ${a.platform}: ${a.handle} (${a.followers} followers)`).join("\n")}
` : ""}

GOALS (${parsedInput.goals.length}):
${parsedInput.goals.map((g) => `- ${g.goal} (Priority: ${g.priority})`).join("\n")}

${parsedInput.budget ? `BUDGET:
- Monthly: ${parsedInput.budget.monthly ? `$${parsedInput.budget.monthly}` : "Not specified"}
- Has separate ad spend: ${parsedInput.budget.hasAdSpend ? "Yes" : "No"}
` : ""}

${parsedInput.currentPainPoints?.length ? `PAIN POINTS:
${parsedInput.currentPainPoints.map((p) => `- ${p}`).join("\n")}
` : ""}

${parsedInput.teamInfo ? `TEAM INFO:
- Has social manager: ${parsedInput.teamInfo.hasSocialManager ? "Yes" : "No"}
- Has content creator: ${parsedInput.teamInfo.hasContentCreator ? "Yes" : "No"}
- Has designer: ${parsedInput.teamInfo.hasDesigner ? "Yes" : "No"}
- Preferred involvement: ${parsedInput.teamInfo.preferredInvolvement || "Not specified"}
` : ""}

INSTRUCTIONS:
1. Design ordered onboarding steps that make sense for this client
2. Identify required brand voice setup questions
3. Recommend a subscription tier based on goals and budget
4. Prioritize platforms based on industry and goals
5. Suggest initial content strategy and campaigns
6. Create a realistic timeline with milestones
7. Recommend required/recommended integrations
8. Provide confidence score based on information available

Respond with a JSON object matching this schema:
${JSON.stringify(OnboardingIntelligenceSchema.shape, null, 2)}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create a comprehensive onboarding plan for ${parsedInput.clientInfo.companyName}.`,
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

    const parsed = OnboardingIntelligenceSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.confidenceScore < 0.6;

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${parsed.confidenceScore}): Insufficient information to create optimal onboarding plan`
        : undefined,
      tokensUsed,
    };
  }
}
