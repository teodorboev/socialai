import { inngest } from "../client";
import { SocialListeningAgent } from "@/agents/social-listening";
import { prisma } from "@/lib/prisma";

/**
 * Social Listening Scan - Monitors brand mentions across platforms
 * Runs every 30 minutes
 */
export const socialListeningScan = inngest.createFunction(
  {
    id: "social-listening-scan",
    name: "Social Listening Scan",
    retries: 2,
  },
  {
    cron: "*/30 * * * *",
  },
  async ({ step }) => {
    // Get organizations with listening enabled
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: { plan: { not: "STARTER" } },
        include: {
          brandConfig: true,
          listeningKeywords: { where: { isEnabled: true } },
        },
        take: 10,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.brandConfig || org.listeningKeywords.length === 0) continue;

      const result = await step.run(`scan-${org.id}`, async () => {
        const agent = new SocialListeningAgent();
        
        // Get recent mentions from DB
        const recentMentions = await prisma.listeningMention.findMany({
          where: { organizationId: org.id },
          orderBy: { detectedAt: "desc" },
          take: 30,
        });

        // Get sentiment baseline
        const baseline = await prisma.listeningMention.groupBy({
          by: ["sentiment"],
          where: { organizationId: org.id },
          _count: true,
        });

        const positiveCount = baseline.find((b: any) => b.sentiment === "POSITIVE")?._count || 0;
        const neutralCount = baseline.find((b: any) => b.sentiment === "NEUTRAL")?._count || 0;
        const negativeCount = baseline.find((b: any) => b.sentiment === "NEGATIVE")?._count || 0;
        const total = positiveCount + neutralCount + negativeCount;

        const competitors = org.brandConfig?.competitors 
          ? (org.brandConfig.competitors as any[])?.map((c: any) => c.name) || []
          : [];
        const brandConfig = org.brandConfig;

        if (!brandConfig) return { success: false, error: "No brand config" };

        return agent.run(org.id, {
          organizationId: org.id,
          brandConfig: {
            brandName: brandConfig.brandName,
            alternateNames: [brandConfig.brandName.toLowerCase()],
            industry: brandConfig.industry || "general",
            competitors,
          },
          trackingKeywords: org.listeningKeywords.map((k: any) => k.keyword),
          trackingHashtags: org.listeningKeywords.filter((k: any) => k.type === "hashtag").map((k: any) => k.keyword),
          excludeKeywords: [],
          sentimentBaseline: {
            positive: total > 0 ? (positiveCount / total) * 100 : 70,
            neutral: total > 0 ? (neutralCount / total) * 100 : 20,
            negative: total > 0 ? (negativeCount / total) * 100 : 10,
          },
          recentMentions: recentMentions.map((m: any) => ({
            platform: m.platform,
            author: m.authorHandle || m.author,
            body: m.body,
            sentiment: m.sentiment || "NEUTRAL",
            reach: m.reach,
          })),
        });
      });

      if (result.success && "data" in result && result.data) {
        const data = result.data as any;
        if (data.alerts?.length > 0) {
          for (const alert of data.alerts) {
            if (alert.severity === "critical") {
              await step.run(`escalate-${org.id}`, async () => {
                await prisma.escalation.create({
                  data: {
                    organizationId: org.id,
                    agentName: "SOCIAL_LISTENING" as any,
                    reason: alert.title,
                    context: alert as any,
                    priority: "HIGH",
                    status: "OPEN",
                  },
                });
              });
            }
          }
        }
      }

      const mentionCount = "data" in result && result.data ? (result.data as any)?.mentionCount : 0;
      results.push({ orgId: org.id, mentions: mentionCount });
    }

    return { organizationsScanned: results.length, results };
  }
);
