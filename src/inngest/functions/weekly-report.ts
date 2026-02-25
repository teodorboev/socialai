import { inngest } from "../client";
import { ReportingNarratorAgent } from "@/agents/reporting-narrator";
import { prisma } from "@/lib/prisma";

export const weeklyReport = inngest.createFunction(
  {
    id: "weekly-report",
    name: "Weekly Report",
    retries: 2,
  },
  {
    cron: "0 8 * * 1", // Weekly on Monday at 8 AM
  },
  async ({ step }) => {
    // Get all active organizations
    const organizations = await step.run("get-active-orgs", async () => {
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
      const reportResult = await step.run(`generate-report-${org.id}`, async () => {
        // Get analytics for the week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const analytics = await prisma.analyticsSnapshot.findMany({
          where: {
            organizationId: org.id,
            snapshotDate: { gte: weekAgo },
          },
        });

        const content = await prisma.content.findMany({
          where: {
            organizationId: org.id,
            status: "PUBLISHED",
            publishedAt: { gte: weekAgo },
          },
        });

        const escalations = await prisma.escalation.findMany({
          where: {
            organizationId: org.id,
            createdAt: { gte: weekAgo },
          },
        });

        const agent = new ReportingNarratorAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          period: { start: weekAgo, end: new Date() },
          metrics: {
            totalPosts: content.length,
            totalImpressions: analytics.reduce((sum: number, a: any) => sum + (a.impressions || 0), 0),
            totalEngagement: analytics.reduce((sum: number, a: any) => sum + ((a.clicks || 0) + (a.shares || 0) + (a.saves || 0)), 0),
            avgEngagementRate: analytics.length > 0 
              ? analytics.reduce((sum: number, a: any) => sum + (a.engagementRate || 0), 0) / analytics.length 
              : 0,
            followerGrowth: analytics.reduce((sum: number, a: any) => sum + (a.followersChange || 0), 0),
          },
          contentPerformance: content.map((c: any) => ({
            id: c.id,
            platform: c.platform,
            contentType: c.contentType,
            engagement: 0, // Would be calculated from analytics
          })),
          escalationsCount: escalations.length,
        });
      });

      if (reportResult.success && reportResult.data) {
        results.push({ orgId: org.id, hasReport: true });
      }
    }

    return { organizationsProcessed: results.length };
  }
);
