import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { generateStrategy } from "@/agents/strategy";

// Monthly strategy planner - runs on the 1st of each month
export const monthlyStrategyPlanner = inngest.createFunction(
  {
    id: "monthly-strategy-planner",
    name: "Monthly Strategy Planner",
    retries: 2,
  },
  {
    cron: "0 6 1 * *", // 1st of each month at 6am UTC
  },
  async ({ step }) => {
    // Get all active organizations with brand config
    const organizations = await step.run("get-active-organizations", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true }, select: { platform: true } },
        },
        take: 50,
      });
    });

    const results = [];

    for (const org of organizations) {
      // Skip if no connected platforms
      if (!org.socialAccounts.length) {
        continue;
      }

      const result = await step.run(`generate-strategy-${org.id}`, async () => {
        try {
          await generateStrategy(org.id);
          return { success: true };
        } catch (error) {
          console.error(`Failed to generate strategy for org ${org.id}:`, error);
          return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });

      results.push({ organizationId: org.id, ...result });
    }

    return { organizationsProcessed: organizations.length, results };
  }
);

// Generate strategy on-demand (e.g., after onboarding)
export const onOnboardingComplete = inngest.createFunction(
  {
    id: "on-onboarding-complete",
    name: "On Onboarding Complete",
    retries: 2,
  },
  {
    event: "organization/onboarding_complete",
  },
  async ({ event }) => {
    await generateStrategy(event.data.organizationId);
    return { generated: true };
  }
);
