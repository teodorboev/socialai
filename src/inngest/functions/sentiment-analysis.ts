import { inngest } from "../client";
import { SentimentIntelligenceAgent } from "@/agents/sentiment-intelligence";
import { prisma } from "@/lib/prisma";

export const sentimentAnalysis = inngest.createFunction(
  {
    id: "sentiment-analysis",
    name: "Sentiment Analysis",
    retries: 2,
  },
  {
    cron: "0 */6 * * *", // Every 6 hours
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
        take: 30,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (org.socialAccounts.length === 0) continue;

      // Get recent engagements
      const recentEngagements = await step.run(`get-engagements-${org.id}`, async () => {
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);

        return prisma.engagement.findMany({
          where: {
            organizationId: org.id,
            createdAt: { gte: dayAgo },
            sentiment: null, // Only analyze unsentimented
          },
          take: 100,
        });
      });

      if (recentEngagements.length === 0) continue;

      const sentimentResult = await step.run(`analyze-sentiment-${org.id}`, async () => {
        const agent = new SentimentIntelligenceAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          engagements: recentEngagements.map((e: any) => ({
            id: e.id,
            body: e.body,
            engagementType: e.engagementType,
          })),
        });
      });

      if (sentimentResult.success && sentimentResult.data) {
        const data = sentimentResult.data as any;
        
        // Update engagements with sentiment
        await step.run(`update-sentiments-${org.id}`, async () => {
          for (const sentiment of data.sentiments || []) {
            await prisma.engagement.update({
              where: { id: sentiment.id },
              data: { sentiment: sentiment.sentiment },
            });
          }
        });

        results.push({ orgId: org.id, analyzed: data.sentiments?.length || 0 });
      }
    }

    return { organizationsProcessed: results.length, totalAnalyzed: results.reduce((sum: number, r: any) => sum + r.analyzed, 0) };
  }
);
