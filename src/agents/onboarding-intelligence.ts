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
    super("ONBOARDING_INTELLIGENCE");
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
    const cachedBlocks = await this.buildCachedPrompt(orgContext);
    const systemPrompt = cachedBlocks.map(b => b.text).join("\n\n");

    const result = await this.callLLM<OnboardingIntelligence>({
      system: systemPrompt,
      userMessage: `Create a comprehensive onboarding plan for ${parsedInput.clientInfo.companyName}.`,
      schema: OnboardingIntelligenceSchema,
      maxTokens: 3500,
    });

    if (!result.data) {
      throw new Error("Failed to generate structured onboarding plan");
    }

    const shouldEscalate = result.data.confidenceScore < 0.6;

    return {
      success: true,
      data: result.data,
      confidenceScore: result.data.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `Low confidence score (${result.data.confidenceScore}): Insufficient information to create optimal onboarding plan`
        : undefined,
      tokensUsed: result.tokensUsed,
    };
  }
}
