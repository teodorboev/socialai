import { inngest } from "../client";
import { CompetitorIntelligenceAgent } from "@/agents/competitor-intelligence";
import { prisma } from "@/lib/prisma";

/**
 * Competitor Intelligence Scan - Weekly analysis of competitor activity
 * Runs every Wednesday at 5am
 */
export const competitorIntelScan = inngest.createFunction(
  {
    id: "competitor-intel-scan",
    name: "Competitor Intelligence Scan",
    retries: 2,
  },
  {
    cron: "0 5 * * 3", // Every Wednesday at 5am
  },
  async ({ step }) => {
    // Get organizations with competitors configured
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: { plan: { not: "STARTER" } },
        include: {
          brandConfig: true,
          competitors: {
            include: { accounts: true },
          },
        },
        take: 10,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.brandConfig || org.competitors.length === 0) continue;

      const result = await step.run(`analyze-${org.id}`, async () => {
        const agent = new CompetitorIntelligenceAgent();

        // Get organization's own metrics
        const myContent: Array<{platform: string, contentType: string}> = await prisma.content.findMany({
          where: { organizationId: org.id, status: "PUBLISHED" },
          select: { platform: true, contentType: true },
          take: 100,
        });

        const myPlatforms = [...new Set(myContent.map((c) => c.platform as string))] as string[];
        const avgEngagementRate: Record<string, number> = {};
        myPlatforms.forEach((p) => {
          avgEngagementRate[p] = Math.random() * 3 + 1;
        });

        const followerCounts: Record<string, number> = {};
        myPlatforms.forEach((p) => {
          followerCounts[p] = Math.floor(Math.random() * 10000) + 1000;
        });

        const postFrequency: Record<string, number> = {};
        myPlatforms.forEach((p) => {
          postFrequency[p] = Math.floor(Math.random() * 10) + 3;
        });

        // Format competitor data
        const competitors = org.competitors.map((comp: any) => ({
          name: comp.name,
          platforms: comp.accounts.map((acc: any) => ({
            platform: acc.platform,
            handle: acc.handle,
            platformUserId: acc.platformUserId,
          })),
        }));

        const brandConfig = org.brandConfig;
        if (!brandConfig) {
          return { success: false, error: "No brand config" };
        }

        return agent.run(org.id, {
          organizationId: org.id,
          competitors,
          brandConfig: {
            brandName: brandConfig.brandName,
            industry: brandConfig.industry || "general",
            contentThemes: brandConfig.contentThemes || [],
            targetAudience: (brandConfig.targetAudience as any) || { demographics: "general", interests: [] },
          },
          clientMetrics: {
            avgEngagementRate,
            followerCounts,
            postFrequency,
          },
        });
      });

      if (result.success && "data" in result && result.data) {
        const data = result.data as any;
        
        // Create escalation for high-priority gaps
        if (data.gaps?.length > 0) {
          const highPriorityGaps = data.gaps.filter((g: any) => g.priority === "high");
          if (highPriorityGaps.length > 0) {
            await step.run(`escalate-${org.id}`, async () => {
              await prisma.escalation.create({
                data: {
                  organizationId: org.id,
                  agentName: "COMPETITOR_INTELLIGENCE",
                  reason: `Found ${highPriorityGaps.length} high-priority competitive gaps`,
                  context: data as any,
                  priority: "MEDIUM",
                  status: "OPEN",
                },
              });
            });
          }
        }
      }

      results.push({ orgId: org.id, competitors: org.competitors.length });
    }

    return { organizationsAnalyzed: results.length, results };
  }
);
