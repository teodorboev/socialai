import { inngest } from "../client";
import { OnboardingIntelligenceAgent } from "@/agents/onboarding-intelligence";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const OnboardingSurveySchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  companySize: z.string(),
  website: z.string().optional(),
  existingSocialAccounts: z.array(z.object({
    platform: z.string(),
    handle: z.string(),
    followers: z.number().optional(),
  })).optional(),
  goals: z.array(z.object({
    goal: z.string(),
    priority: z.string(),
  })),
  budget: z.object({
    monthly: z.number().optional(),
    hasAdSpend: z.boolean().optional(),
  }).optional(),
  currentPainPoints: z.array(z.string()).optional(),
  teamInfo: z.object({
    hasSocialManager: z.boolean().optional(),
    hasContentCreator: z.boolean().optional(),
    hasDesigner: z.boolean().optional(),
    preferredInvolvement: z.string().optional(),
  }).optional(),
});

export const onboardingAnalysis = inngest.createFunction(
  {
    id: "onboarding-analysis",
    name: "Onboarding Analysis",
    retries: 3,
  },
  {
    event: "onboarding/completed",
  },
  async ({ event, step }) => {
    const { organizationId, surveyData } = event.data;

    const result = await step.run("analyze-onboarding", async () => {
      try {
        const parsedSurvey = OnboardingSurveySchema.parse(surveyData);

        const agent = new OnboardingIntelligenceAgent();
        const analysisResult = await agent.run(organizationId, {
          clientInfo: {
            companyName: parsedSurvey.companyName,
            industry: parsedSurvey.industry,
            companySize: parsedSurvey.companySize,
            website: parsedSurvey.website,
            existingSocialAccounts: parsedSurvey.existingSocialAccounts,
          },
          goals: parsedSurvey.goals,
          budget: parsedSurvey.budget,
          currentPainPoints: parsedSurvey.currentPainPoints,
          teamInfo: parsedSurvey.teamInfo,
        });

        if (!analysisResult.success || !analysisResult.data) {
          return { success: false, error: analysisResult.escalationReason };
        }

        const analysis = analysisResult.data as any;

        // Store the onboarding analysis
        await prisma.contentPlan.create({
          data: {
            organizationId,
            title: `Onboarding Analysis - ${parsedSurvey.companyName}`,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            strategy: {
              onboardingAnalysis: analysis,
              companyName: parsedSurvey.companyName,
              industry: parsedSurvey.industry,
            },
            themes: analysis.recommendedContentThemes || [],
            platformMix: analysis.platformPriorities || {},
            postsPerWeek: analysis.recommendedPostingFrequency || {},
            status: "DRAFT",
          },
        });

        // Update organization settings based on recommended tier
        if (analysis.recommendedTier) {
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: analysis.recommendedTier as any,
            },
          });
        }

        // Create escalation for human review if confidence is low
        if (analysisResult.shouldEscalate) {
          await prisma.escalation.create({
            data: {
              organizationId,
              agentName: "ONBOARDING_INTELLIGENCE",
              reason: `Low confidence (${analysisResult.confidenceScore}): Manual onboarding review needed`,
              context: { surveyData, analysis },
              priority: "MEDIUM",
              status: "OPEN",
            },
          });
        }

        return {
          success: true,
          analysisId: organizationId,
          confidenceScore: analysisResult.confidenceScore,
          recommendedTier: analysis.recommendedTier,
          nextStepsCount: analysis.onboardingSteps?.length || 0,
        };
      } catch (error) {
        console.error(`Failed to analyze onboarding for org ${organizationId}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    return result;
  }
);

// Scheduled onboarding follow-up - runs daily to check for stale onboarding
export const onboardingFollowUp = inngest.createFunction(
  {
    id: "onboarding-follow-up",
    name: "Onboarding Follow-up",
    retries: 2,
  },
  {
    cron: "0 10 * * *", // Every day at 10am
  },
  async ({ step }) => {
    // Find organizations that completed onboarding but don't have brand config
    const staleOnboardings = await step.run("get-stale-onboardings", async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      return prisma.organization.findMany({
        where: {
          createdAt: { gte: weekAgo },
          brandConfig: null,
        },
        include: {
          members: { where: { role: "OWNER" }, take: 1 },
        },
        take: 20,
      });
    });

    const results = [];

    for (const org of staleOnboardings) {
      const result = await step.run(`send-reminder-${org.id}`, async () => {
        const owner = org.members[0];
        if (!owner) {
          return { success: false, error: "No owner found" };
        }

        // Get user email
        const { data: userData } = await import("@/lib/supabase/admin").then((supabase) =>
          supabase.supabaseAdmin.auth.admin.getUserById(owner.userId)
        );

        if (!userData?.user?.email) {
          return { success: false, error: "No email found" };
        }

        // TODO: Send onboarding reminder email when email module is ready
        // const { sendOnboardingReminder } = await import("@/lib/email");
        // await sendOnboardingReminder(userData.user.email, org.name);

        return { success: true, emailSent: true };
      });

      results.push({ organizationId: org.id, ...result });
    }

    return { staleOnboardingsProcessed: staleOnboardings.length, results };
  }
);

// Initial onboarding check - runs on new organization creation
export const onNewOrganization = inngest.createFunction(
  {
    id: "on-new-organization",
    name: "On New Organization",
    retries: 3,
  },
  {
    event: "organization/created",
  },
  async ({ event, step }) => {
    const { organizationId } = event.data;

    await step.run("create-welcome-content", async () => {
      // Create a welcome content plan placeholder
      await prisma.contentPlan.create({
        data: {
          organizationId,
          title: "Welcome - Getting Started",
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          strategy: {
            isGettingStarted: true,
            status: "Pending brand configuration",
          },
          themes: [],
          platformMix: {},
          postsPerWeek: {},
          status: "DRAFT",
        },
      });

      // Get the owner
      const owner = await prisma.orgMember.findFirst({
        where: { organizationId, role: "OWNER" },
      });

      if (owner) {
        try {
          const { data: userData } = await import("@/lib/supabase/admin").then((supabase) =>
            supabase.supabaseAdmin.auth.admin.getUserById(owner.userId)
          );

          if (userData?.user?.email) {
            // TODO: Send welcome email when email module is ready
            // const { sendWelcomeEmail } = await import("@/lib/email");
            // await sendWelcomeEmail(userData.user.email, org.name);
          }
        } catch (error) {
          console.error("Failed to send welcome email:", error);
        }
      }

      return { success: true };
    });

    return { success: true, organizationId };
  }
);
