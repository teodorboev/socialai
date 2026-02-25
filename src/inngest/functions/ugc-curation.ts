import { inngest } from "../client";
import { UGCuratorAgent } from "@/agents/ugc-curator";
import { prisma } from "@/lib/prisma";

export const ugcCuration = inngest.createFunction(
  {
    id: "ugc-curation",
    name: "UGC Curation",
    retries: 2,
  },
  {
    cron: "0 */8 * * *", // Every 8 hours
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          socialAccounts: { where: { isActive: true } },
        },
        take: 20,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (org.socialAccounts.length === 0) continue;

      const curationResult = await step.run(`curate-ugc-${org.id}`, async () => {
        const agent = new UGCuratorAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          platforms: org.socialAccounts.map((a: any) => a.platform),
          hashtagSources: ["#brandname", "#brandnameReviews"],
          timeWindow: "7 days",
        });
      });

      if (curationResult.success && curationResult.data) {
        const data = curationResult.data as any;
        
        if (data.curatedUGC?.length > 0) {
          // Log the curated UGC
          await step.run(`log-ugc-${org.id}`, async () => {
            await prisma.agentLog.create({
              data: {
                organizationId: org.id,
                agentName: "UGC_CURATOR",
                action: "UGC Curation",
                outputSummary: { ugcCount: data.curatedUGC.length },
                confidenceScore: curationResult.confidenceScore,
                status: "SUCCESS",
              },
            });
          });
        }

        results.push({ orgId: org.id, ugcFound: data.curatedUGC?.length || 0 });
      }
    }

    return { organizationsProcessed: results.length, totalUGC: results.reduce((sum: number, r: any) => sum + r.ugcFound, 0) };
  }
);
