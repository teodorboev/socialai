import { inngest } from "../client";
import { ContentReplenishmentAgent } from "@/agents/content-replenishment";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { prisma } from "@/lib/prisma";

/**
 * Content Replenishment - Ensures no client goes dark
 * Runs every 2 hours to check content pipeline health
 */
export const contentReplenishment = inngest.createFunction(
  {
    id: "content-replenishment",
    name: "Content Replenishment",
    retries: 1,
  },
  {
    cron: "0 */2 * * *", // Every 2 hours
  },
  async ({ step }) => {
    // Get all active organizations with settings
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
          brandConfig: { isNot: null },
        },
        include: {
          orgSettings: true,
          socialAccounts: { where: { isActive: true } },
        },
        take: 20,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.orgSettings || org.socialAccounts.length === 0) continue;

      const checkResult = await step.run(`check-${org.id}`, async () => {
        const agent = new ContentReplenishmentAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          settings: {
            contentBufferDays: org.orgSettings!.contentBufferDays,
            maxPostsPerDayPerPlatform: org.orgSettings!.maxPostsPerDayPerPlatform,
            platforms: org.socialAccounts.map((a) => a.platform.toLowerCase()),
            alertAfterSilentHours: 48,
          },
        });
      });

      const resultData = checkResult.data as { status: string; actions: Array<{ type: string; platform?: string; count?: number; scheduleId?: string }> } | undefined;

      // Execute actions based on result
      if (checkResult.success && resultData) {
        for (const action of resultData.actions) {
          await step.run(`action-${org.id}-${action.type}`, async () => {
            switch (action.type) {
              case "trigger_content_creator":
                // Trigger content creation for deficient platforms
                const account = org.socialAccounts.find(
                  (a) => a.platform.toLowerCase() === action.platform?.toLowerCase()
                );
                if (account) {
                  const creator = new ContentCreatorAgent();
                  const brandConfig = await prisma.brandConfig.findUnique({
                    where: { organizationId: org.id },
                  });
                  if (brandConfig) {
                    await creator.run(org.id, {
                      organizationId: org.id,
                      platform: account.platform.toLowerCase(),
                      brandConfig: {
                        brandName: brandConfig.brandName,
                        voiceTone: brandConfig.voiceTone as any,
                        contentThemes: brandConfig.contentThemes,
                        doNots: brandConfig.doNots,
                        targetAudience: brandConfig.targetAudience as any,
                        hashtagStrategy: brandConfig.hashtagStrategy as any,
                      },
                    });
                  }
                }
                break;

              case "retry_failed_publish":
                // Re-queue failed schedule for retry
                if (action.scheduleId) {
                  await prisma.schedule.update({
                    where: { id: action.scheduleId },
                    data: { status: "PENDING", retryCount: { increment: 1 } },
                  });
                }
                break;

              case "notify_low_queue":
                // Log notification (could send email in production)
                console.log(`Low queue alert for org ${org.id}: ${action.count} posts needed`);
                break;
            }
          });
        }
      }

      results.push({ orgId: org.id, status: resultData?.status, actions: resultData?.actions?.length });
    }

    return { organizationsProcessed: results.length, results };
  }
);
