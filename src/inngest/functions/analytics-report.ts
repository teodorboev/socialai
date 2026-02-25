import { inngest } from "../client";
import { AnalyticsAgent } from "@/agents/analytics";
import { prisma } from "@/lib/prisma";

interface SnapshotData {
  platform: string;
  followers: number;
  followersChange: number;
  impressions: number;
  reach: number;
  engagementRate: number;
  clicks: number;
  shares: number;
  saves: number;
  snapshotDate: Date;
}

interface ContentData {
  contentId: string;
  platform: string;
  contentType: string;
  caption: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
  clicks: number;
  shares: number;
  saves: number;
  publishedAt: Date;
}

export const analyticsReport = inngest.createFunction(
  {
    id: "analytics-report",
    name: "Analytics Report",
    retries: 2,
  },
  {
    cron: "0 9 * * 1", // Every Monday at 9am
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-organizations", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          members: { where: { role: "OWNER" }, take: 1 },
        },
        take: 50,
      });
    });

    const results = [];

    for (const org of organizations) {
      const result = await step.run(`generate-report-${org.id}`, async () => {
        try {
          const brandConfig = org.brandConfig;
          if (!brandConfig) {
            return { success: false, error: "No brand config" };
          }

          // Get analytics snapshots for the last 7 days
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);

          const snapshots = await prisma.analyticsSnapshot.findMany({
            where: {
              organizationId: org.id,
              snapshotDate: { gte: weekAgo },
            },
            orderBy: { snapshotDate: "asc" },
          });

          // Get content performance for the period
          const contentPerformance = await prisma.content.findMany({
            where: {
              organizationId: org.id,
              status: "PUBLISHED",
              publishedAt: { gte: weekAgo },
            },
            select: {
              id: true,
              platform: true,
              contentType: true,
              caption: true,
              publishedAt: true,
            },
          });

          // Get previous recommendations
          const previousPlan = await prisma.contentPlan.findFirst({
            where: { organizationId: org.id, status: "ACTIVE" },
            orderBy: { periodStart: "desc" },
          });

          const previousRecommendations = previousPlan
            ? ((previousPlan.strategy as any)?.recommendations?.map((r: any) => r.recommendation) || [])
            : [];

          const agent = new AnalyticsAgent();
          const reportResult = await agent.run(org.id, {
            organizationId: org.id,
            brandName: brandConfig.brandName,
            periodDays: 7,
            snapshots: snapshots.map((s: any) => ({
              platform: s.platform,
              followers: s.followers || 0,
              followersChange: s.followersChange || 0,
              impressions: s.impressions || 0,
              reach: s.reach || 0,
              engagementRate: s.engagementRate || 0,
              clicks: s.clicks || 0,
              shares: s.shares || 0,
              saves: s.saves || 0,
              snapshotDate: s.snapshotDate,
            })),
            contentPerformance: contentPerformance.map((c: any) => ({
              contentId: c.id,
              platform: c.platform,
              contentType: c.contentType,
              caption: c.caption,
              impressions: 0,
              engagement: 0,
              engagementRate: 0,
              clicks: 0,
              shares: 0,
              saves: 0,
              publishedAt: c.publishedAt!,
            })),
            previousRecommendations,
          });

          if (!reportResult.success || !reportResult.data) {
            return { success: false, error: reportResult.escalationReason };
          }

          const report = reportResult.data as any;

          // Update content plan with recommendations
          if (previousPlan && report.recommendations?.length) {
            await prisma.contentPlan.update({
              where: { id: previousPlan.id },
              data: {
                strategy: {
                  ...(previousPlan.strategy as object),
                  recommendations: report.recommendations,
                  lastReportDate: new Date().toISOString(),
                },
              },
            });
          }

          // Get owner for email
          const owner = org.members[0];
          if (owner) {
            const { data: userData } = await import("@/lib/supabase/admin").then((supabase) =>
              supabase.supabaseAdmin.auth.admin.getUserById(owner.userId)
            );

            if (userData?.user?.email) {
              const { sendWeeklyReportEmail } = await import("@/lib/email");
              await sendWeeklyReportEmail(
                userData.user.email,
                {
                  summary: report.summary,
                  totalImpressions: report.metrics.totalImpressions,
                  totalEngagements: report.metrics.totalEngagements,
                  bestPerformingPlatform: report.metrics.bestPerformingPlatform,
                },
                brandConfig.brandName
              );
            }
          }

          return {
            success: true,
            reportId: previousPlan?.id,
            summary: report.summary,
            recommendationsCount: report.recommendations?.length || 0,
          };
        } catch (error) {
          console.error(`Failed to generate report for org ${org.id}:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push({ organizationId: org.id, ...result });
    }

    return { organizationsProcessed: organizations.length, results };
  }
);

// Monthly analytics report
export const monthlyAnalyticsReport = inngest.createFunction(
  {
    id: "monthly-analytics-report",
    name: "Monthly Analytics Report",
    retries: 2,
  },
  {
    cron: "0 9 1 * *", // First day of every month at 9am
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-organizations", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          members: { where: { role: "OWNER" }, take: 1 },
        },
        take: 50,
      });
    });

    const results = [];

    for (const org of organizations) {
      const result = await step.run(`generate-monthly-report-${org.id}`, async () => {
        try {
          const brandConfig = org.brandConfig;
          if (!brandConfig) {
            return { success: false, error: "No brand config" };
          }

          // Get analytics snapshots for the last 30 days
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);

          const snapshots = await prisma.analyticsSnapshot.findMany({
            where: {
              organizationId: org.id,
              snapshotDate: { gte: monthAgo },
            },
            orderBy: { snapshotDate: "asc" },
          });

          // Get content performance for the month
          const contentPerformance = await prisma.content.findMany({
            where: {
              organizationId: org.id,
              status: "PUBLISHED",
              publishedAt: { gte: monthAgo },
            },
            select: {
              id: true,
              platform: true,
              contentType: true,
              caption: true,
              publishedAt: true,
            },
          });

          const agent = new AnalyticsAgent();
          const reportResult = await agent.run(org.id, {
            organizationId: org.id,
            brandName: brandConfig.brandName,
            periodDays: 30,
            snapshots: snapshots.map((s: any) => ({
              platform: s.platform,
              followers: s.followers || 0,
              followersChange: s.followersChange || 0,
              impressions: s.impressions || 0,
              reach: s.reach || 0,
              engagementRate: s.engagementRate || 0,
              clicks: s.clicks || 0,
              shares: s.shares || 0,
              saves: s.saves || 0,
              snapshotDate: s.snapshotDate,
            })),
            contentPerformance: contentPerformance.map((c: any) => ({
              contentId: c.id,
              platform: c.platform,
              contentType: c.contentType,
              caption: c.caption,
              impressions: 0,
              engagement: 0,
              engagementRate: 0,
              clicks: 0,
              shares: 0,
              saves: 0,
              publishedAt: c.publishedAt!,
            })),
          });

          if (!reportResult.success || !reportResult.data) {
            return { success: false, error: reportResult.escalationReason };
          }

          const report = reportResult.data as any;

          return {
            success: true,
            summary: report.summary,
            metrics: report.metrics,
            recommendationsCount: report.recommendations?.length || 0,
          };
        } catch (error) {
          console.error(`Failed to generate monthly report for org ${org.id}:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push({ organizationId: org.id, ...result });
    }

    return { organizationsProcessed: organizations.length, results };
  }
);
