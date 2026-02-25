import { inngest } from "../client";
import { RoiAttributionAgent } from "@/agents/roi-attribution";
import { prisma } from "@/lib/prisma";

export const roiAttribution = inngest.createFunction(
  {
    id: "roi-attribution",
    name: "ROI Attribution",
    retries: 2,
  },
  {
    cron: "0 6 * * 0", // Weekly on Sunday at 6 AM
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          socialAccounts: { where: { isActive: true } },
          content: { where: { status: "PUBLISHED" }, take: 100 },
        },
        take: 30,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (org.socialAccounts.length === 0) continue;

      const roiResult = await step.run(`calculate-roi-${org.id}`, async () => {
        // Get content with engagement data
        const content = await prisma.content.findMany({
          where: {
            organizationId: org.id,
            status: "PUBLISHED",
          },
          include: {
            schedule: true,
          },
          orderBy: { publishedAt: "desc" },
          take: 50,
        });

        const agent = new RoiAttributionAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          contentPerformance: content.map((c: any) => ({
            id: c.id,
            platform: c.platform,
            publishedAt: c.publishedAt,
            engagement: 0, // Would come from analytics
            clicks: 0,
            conversions: 0,
          })),
          attributionWindow: "30 days",
        });
      });

      if (roiResult.success && roiResult.data) {
        const data = roiResult.data as any;
        
        // Log ROI data
        await step.run(`log-roi-${org.id}`, async () => {
          await prisma.agentLog.create({
            data: {
              organizationId: org.id,
              agentName: "ROI_ATTRIBUTION",
              action: "Weekly ROI Calculation",
              outputSummary: {
                totalRevenue: data.totalRevenue,
                roi: data.roi,
                topPerformingContent: data.topPerformingContent?.slice(0, 5),
              },
              confidenceScore: roiResult.confidenceScore,
              status: "SUCCESS",
            },
          });
        });

        results.push({ orgId: org.id, roi: data.roi, revenue: data.totalRevenue });
      }
    }

    return { organizationsProcessed: results.length };
  }
);
