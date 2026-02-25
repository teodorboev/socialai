import { inngest } from "../client";
import { TrendScoutAgent } from "@/agents/trend-scout";
import { prisma } from "@/lib/prisma";

export const trendScan = inngest.createFunction(
  {
    id: "trend-scan",
    name: "Trend Scan",
    retries: 2,
  },
  {
    cron: "0 */4 * * *", // Every 4 hours
  },
  async ({ step }) => {
    // Get all active organizations
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true }, take: 3 },
        },
        take: 20,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.brandConfig || org.socialAccounts.length === 0) continue;

      const result = await step.run(`scan-trends-${org.id}`, async () => {
        const agent = new TrendScoutAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          platforms: org.socialAccounts.map((a: { platform: string }) => a.platform.toLowerCase()),
          industry: org.brandConfig?.industry || "general",
          targetAudience: org.brandConfig?.targetAudience as any,
          contentThemes: org.brandConfig?.contentThemes || [],
        });
      });

      // Check for urgent trends
      if (result.success && result.data) {
        const trends = result.data as any;
        const urgentTrends = trends.filter((t: any) => t.isUrgent);

        if (urgentTrends.length > 0) {
          // Send to content pipeline for immediate action
          await step.run(`trigger-urgent-content-${org.id}`, async () => {
            await inngest.send({
              name: "trend/urgent",
              data: {
                organizationId: org.id,
                trend: urgentTrends[0],
              },
            });
          });
        }

        results.push({ orgId: org.id, trendsFound: trends.length, urgentTrends: urgentTrends.length });
      }
    }

    return { organizationsProcessed: results.length, results };
  }
);
