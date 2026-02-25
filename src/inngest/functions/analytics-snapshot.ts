import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { createSocialClient } from "@/lib/social/factory";
import type { SocialAccount, Platform } from "@prisma/client";
import { generateWeeklyReport } from "@/agents/analytics";

// Collect metrics every 6 hours
export const analyticsSnapshot = inngest.createFunction(
  {
    id: "analytics-snapshot",
    name: "Analytics Snapshot",
    retries: 2,
  },
  {
    cron: "0 */6 * * *", // Every 6 hours
  },
  async ({ step }) => {
    // Get all active social accounts
    const accounts = await step.run("get-active-accounts", async () => {
      return prisma.socialAccount.findMany({
        where: { isActive: true },
        take: 20,
      });
    });

    const results = [];

    for (const account of accounts) {
      const result = await step.run(`collect-metrics-${account.id}`, async () => {
        try {
          const client = createSocialClient(account.platform, {
            ...account,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken || null,
            tokenExpiresAt: account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null,
            createdAt: new Date(account.createdAt),
            updatedAt: new Date(account.updatedAt),
          } as SocialAccount);

          // Get account metrics
          const metrics = await client.getAccountMetrics();

          // Get previous snapshot for comparison
          const lastSnapshot = await prisma.analyticsSnapshot.findFirst({
            where: { socialAccountId: account.id },
            orderBy: { snapshotDate: "desc" },
          });

          // Create snapshot
          const snapshot = await prisma.analyticsSnapshot.create({
            data: {
              organizationId: account.organizationId,
              socialAccountId: account.id,
              platform: account.platform,
              snapshotDate: new Date(),
              followers: metrics.followers,
              followersChange: metrics.followers - (lastSnapshot?.followers || 0),
              impressions: metrics.impressions,
              reach: metrics.reach,
              engagementRate: metrics.engagementRate,
              clicks: metrics.profileViews || 0,
              shares: 0,
              saves: 0,
            },
          });

          return { success: true, snapshotId: snapshot.id };
        } catch (error) {
          console.error(`Failed to collect metrics for account ${account.id}:`, error);
          return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });

      results.push({ accountId: account.id, ...result });
    }

    return { accountsProcessed: accounts.length, results };
  }
);

// Generate weekly reports every Monday at 9am
export const weeklyAnalyticsReport = inngest.createFunction(
  {
    id: "weekly-analytics-report",
    name: "Weekly Analytics Report",
    retries: 2,
  },
  {
    cron: "0 9 * * 1", // Every Monday at 9am
  },
  async ({ step }) => {
    // Get all active organizations
    const organizations = await step.run("get-active-organizations", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        take: 50,
      });
    });

    const results = [];

    for (const org of organizations) {
      const result = await step.run(`generate-report-${org.id}`, async () => {
        try {
          await generateWeeklyReport(org.id);
          return { success: true };
        } catch (error) {
          console.error(`Failed to generate report for org ${org.id}:`, error);
          return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });

      results.push({ organizationId: org.id, ...result });
    }

    return { organizationsProcessed: organizations.length, results };
  }
);
