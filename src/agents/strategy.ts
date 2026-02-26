import { BaseAgent, type OrgContext } from "./shared/base-agent";
import type { AgentName, Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StrategyPlanSchema, type StrategyPlan } from "@/lib/ai/schemas/strategy";
import { buildStrategyPrompt } from "@/lib/ai/prompts/strategy";

interface StrategyInput {
  organizationId: string;
  brandConfig: {
    brandName: string;
    industry: string;
    targetAudience: {
      demographics?: string;
      interests?: string;
      painPoints?: string;
    };
    voiceTone: {
      adjectives: string[];
      examples: string[];
      avoid: string[];
    };
    contentThemes: string[];
    competitors?: Array<{ name: string; platform: string; handle: string }>;
    brandColors?: { primary: string; secondary: string; accent: string };
    doNots: string[];
  };
  analyticsReport?: {
    summary: string;
    topContent: Array<{ contentId: string; whyItWorked: string }>;
    recommendations: Array<{ recommendation: string; priority: string; targetAgent: string }>;
    optimalPostingTimes: Record<string, string[]>;
  };
  previousPlan?: {
    themes: string[];
    platformMix: Record<string, number>;
    whatWorked: string;
    whatDidnt: string;
  };
  trendContext?: string;
  connectedPlatforms: string[];
  planPeriod: {
    start: string;
    end: string;
  };
  clientGoals?: string[];
}

export class StrategyAgent extends BaseAgent {
  constructor() {
    super("STRATEGY");
  }

  protected async getStaticSystemPrompt(orgContext: OrgContext): Promise<string> {
    const input = orgContext as unknown as StrategyInput;

    try {
      return await this.getPromptFromTemplate("main", {
        brandName: input.brandConfig.brandName,
        industry: input.brandConfig.industry,
        targetAudience: JSON.stringify(input.brandConfig.targetAudience),
        voiceTone: JSON.stringify(input.brandConfig.voiceTone),
        contentThemes: JSON.stringify(input.brandConfig.contentThemes),
        competitors: JSON.stringify(input.brandConfig.competitors || []),
        brandColors: JSON.stringify(input.brandConfig.brandColors),
        doNots: JSON.stringify(input.brandConfig.doNots),
        analyticsReport: input.analyticsReport ? JSON.stringify(input.analyticsReport) : "",
        previousPlan: input.previousPlan ? JSON.stringify(input.previousPlan) : "",
        trendContext: input.trendContext || "",
        connectedPlatforms: JSON.stringify(input.connectedPlatforms),
        planPeriod: JSON.stringify(input.planPeriod),
        clientGoals: JSON.stringify(input.clientGoals || []),
      });
    } catch {
      // Fallback to hardcoded
      try {
        return buildStrategyPrompt(input);
      } catch {
        return "You are an expert social media strategist.";
      }
    }
  }

  async execute(input: StrategyInput) {
    const { organizationId, brandConfig, analyticsReport, previousPlan, trendContext, connectedPlatforms, planPeriod, clientGoals } = input;

    const orgContext: OrgContext = {
      organizationId,
      brandConfig,
      analyticsReport,
      previousPlan,
      trendContext,
      connectedPlatforms,
      planPeriod,
      clientGoals,
    };

    const systemPrompt = await this.buildCachedPrompt(orgContext);

    const { text, tokensUsed } = await this.callClaude({
      system: systemPrompt,
      userMessage: `Create the monthly content strategy for ${brandConfig.brandName}.`,
      maxTokens: 6000,
    });

    if (!text) {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response
    let parsed: StrategyPlan;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = StrategyPlanSchema.parse(JSON.parse(jsonMatch[0]));
    } catch (parseError) {
      console.error("Failed to parse strategy plan:", parseError, text);
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: "Failed to parse AI response",
        tokensUsed,
      };
    }

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.7,
      escalationReason: parsed.confidenceScore < 0.7 ? `Low confidence (${parsed.confidenceScore}): ${parsed.reasoning}` : undefined,
      tokensUsed,
    };
  }
}

// Generate strategy for an organization
export async function generateStrategy(organizationId: string): Promise<void> {
  // Fetch organization with brand config
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { brandConfig: true },
  });

  if (!organization || !organization.brandConfig) {
    console.error(`Organization ${organizationId} not found or no brand config`);
    return;
  }

  // Get connected platforms
  const socialAccounts = await prisma.socialAccount.findMany({
    where: { organizationId, isActive: true },
    select: { platform: true },
  });

  const connectedPlatforms = socialAccounts.map((a) => a.platform);

  if (connectedPlatforms.length === 0) {
    console.error(`No connected platforms for org ${organizationId}`);
    return;
  }

  // Get previous plan
  const previousPlan = await prisma.contentPlan.findFirst({
    where: { organizationId, status: "COMPLETED" },
    orderBy: { periodEnd: "desc" },
  });

  // Determine plan period (current month or next month)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Check if plan already exists for this period
  const existingPlan = await prisma.contentPlan.findFirst({
    where: {
      organizationId,
      periodStart: { gte: new Date(periodStart.setHours(0, 0, 0, 0)) },
      periodEnd: { lte: new Date(periodEnd.setHours(23, 59, 59, 999)) },
    },
  });

  if (existingPlan) {
    console.log(`Strategy plan already exists for org ${organizationId} this period`);
    return;
  }

  const agent = new StrategyAgent();

  try {
    const result = await agent.run(organizationId, {
      organizationId,
      brandConfig: {
        brandName: organization.brandConfig.brandName,
        industry: organization.brandConfig.industry || "General",
        targetAudience: organization.brandConfig.targetAudience as any,
        voiceTone: organization.brandConfig.voiceTone as any,
        contentThemes: organization.brandConfig.contentThemes,
        competitors: organization.brandConfig.competitors as any,
        brandColors: organization.brandConfig.brandColors as any,
        doNots: organization.brandConfig.doNots,
      },
      connectedPlatforms,
      planPeriod: {
        start: periodStart.toISOString().split("T")[0],
        end: periodEnd.toISOString().split("T")[0],
      },
      previousPlan: previousPlan ? {
        themes: previousPlan.themes,
        platformMix: previousPlan.platformMix as Record<string, number>,
        whatWorked: "Previous content performed well",
        whatDidnt: "Need to analyze data",
      } : undefined,
    });

    if (result.success && result.data) {
      const plan = result.data as StrategyPlan;

      // Create the content plan
      await prisma.contentPlan.create({
        data: {
          organizationId,
          title: plan.title,
          periodStart,
          periodEnd,
          strategy: plan as any,
          themes: plan.themes.map((t) => t.theme),
          platformMix: plan.platformMix as any,
          postsPerWeek: plan.postsPerWeek as any,
          status: "DRAFT",
        },
      });

      // For SaaS clients with high confidence, auto-activate
      if (organization.plan !== "STARTER" && plan.confidenceScore >= 0.80) {
        // Update to ACTIVE
        const newPlan = await prisma.contentPlan.findFirst({
          where: { organizationId, status: "DRAFT" },
          orderBy: { createdAt: "desc" },
        });

        if (newPlan) {
          await prisma.contentPlan.update({
            where: { id: newPlan.id },
            data: { status: "ACTIVE" },
          });
        }
      }

      console.log(`Strategy plan created for org ${organizationId}`);
    }
  } catch (error) {
    console.error(`Failed to generate strategy for org ${organizationId}:`, error);
  }
}
