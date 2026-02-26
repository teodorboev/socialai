import { BaseAgent, AgentResult, type OrgContext } from "./shared/base-agent";
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

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as OnboardingIntelligenceInput;
    const parsedInput = OnboardingIntelligenceInputSchema.parse(input);

    try {
      return await this.getPromptFromTemplate("main", {
        companyName: parsedInput.clientInfo.companyName,
        industry: parsedInput.clientInfo.industry,
        companySize: parsedInput.clientInfo.companySize,
        website: parsedInput.clientInfo.website || "",
        goals: JSON.stringify(parsedInput.goals),
        budget: parsedInput.budget ? JSON.stringify(parsedInput.budget) : "",
        painPoints: parsedInput.currentPainPoints ? JSON.stringify(parsedInput.currentPainPoints) : "",
        teamInfo: parsedInput.teamInfo ? JSON.stringify(parsedInput.teamInfo) : "",
      });
    } catch {
      return `You are a Client Onboarding Expert specializing in creating personalized onboarding experiences for new social media management clients.

Your role is to design an onboarding plan that sets new clients up for success based on their specific needs, goals, and resources.`;
    }
  }

  async execute(input: OnboardingIntelligenceInput): Promise<AgentResult<OnboardingIntelligence>> {
    const parsedInput = OnboardingIntelligenceInputSchema.parse(input);

    const orgContext: OrgContext = input as unknown as OrgContext;
    const systemPrompt = await this.buildCachedPrompt(orgContext);

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
