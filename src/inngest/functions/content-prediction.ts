import { inngest } from "../client";
import { PredictiveContentAgent } from "@/agents/predictive-content";
import { prisma } from "@/lib/prisma";

export const contentPrediction = inngest.createFunction(
  {
    id: "content-prediction",
    name: "Content Prediction",
    retries: 2,
  },
  {
    cron: "0 4 * * *", // Daily at 4 AM
  },
  async ({ step }) => {
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          contentPlans: { where: { status: "ACTIVE" }, take: 1 },
        },
        take: 30,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.brandConfig || org.socialAccounts.length === 0) continue;

      const predictionResult = await step.run(`predict-content-${org.id}`, async () => {
        // Get historical content performance
        const historicalContent = await prisma.content.findMany({
          where: {
            organizationId: org.id,
            status: "PUBLISHED",
            publishedAt: { not: null },
          },
          orderBy: { publishedAt: "desc" },
          take: 30,
        });

        const agent = new PredictiveContentAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          historicalPerformance: historicalContent.map((c: any) => ({
            platform: c.platform,
            contentType: c.contentType,
            hashtags: c.hashtags,
            engagement: 0, // Would come from analytics
          })),
          targetPlatforms: org.socialAccounts.map((a: any) => a.platform),
          contentThemes: org.brandConfig?.contentThemes || [],
        });
      });

      if (predictionResult.success && predictionResult.data) {
        const data = predictionResult.data as any;
        
        // Log predictions
        await step.run(`log-predictions-${org.id}`, async () => {
          await prisma.agentLog.create({
            data: {
              organizationId: org.id,
              agentName: "PREDICTIVE_CONTENT",
              action: "Content Predictions",
              outputSummary: {
                recommendations: data.recommendations?.slice(0, 5),
                predictedWinners: data.predictedWinners,
              },
              confidenceScore: predictionResult.confidenceScore,
              status: "SUCCESS",
            },
          });
        });

        results.push({ orgId: org.id, recommendations: data.recommendations?.length || 0 });
      }
    }

    return { organizationsProcessed: results.length };
  }
);
