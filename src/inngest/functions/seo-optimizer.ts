import { inngest } from "../client";
import { SocialSEOAgent } from "@/agents/social-seo";
import { prisma } from "@/lib/prisma";

export const seoOptimizer = inngest.createFunction(
  {
    id: "seo-optimizer",
    name: "SEO Optimizer",
    retries: 2,
  },
  {
    cron: "0 2 * * *", // Daily at 2 AM
  },
  async ({ step }) => {
    // Get all active organizations with content
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" },
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

      // Get recent content for analysis
      const recentContent = await step.run(`get-recent-content-${org.id}`, async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return prisma.content.findMany({
          where: {
            organizationId: org.id,
            status: "PUBLISHED",
            publishedAt: { gte: thirtyDaysAgo },
          },
          orderBy: { publishedAt: "desc" },
          take: 20,
        });
      });

      if (recentContent.length === 0) continue;

      // Run SEO optimization
      const seoResult = await step.run(`optimize-seo-${org.id}`, async () => {
        const agent = new SocialSEOAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          recentContent: recentContent.map((c: any) => ({
            id: c.id,
            caption: c.caption,
            hashtags: c.hashtags,
            platform: c.platform,
          })),
          industry: org.brandConfig?.industry || "general",
          targetKeywords: org.brandConfig?.contentThemes || [],
        });
      });

      if (seoResult.success && seoResult.data) {
        const seoData = seoResult.data as any;
        
        // Update content with optimized hashtags if needed
        if (seoData.recommendations?.length > 0) {
          await step.run(`apply-seo-recommendations-${org.id}`, async () => {
            // Log recommendations for later review
            await prisma.agentLog.create({
              data: {
                organizationId: org.id,
                agentName: "SOCIAL_SEO",
                action: "SEO Optimization",
                inputSummary: { contentCount: recentContent.length },
                outputSummary: seoData.recommendations,
                confidenceScore: seoResult.confidenceScore,
                status: "SUCCESS",
              },
            });
          });
        }

        results.push({ 
          orgId: org.id, 
          contentAnalyzed: recentContent.length,
          recommendations: seoData.recommendations?.length || 0,
          confidenceScore: seoResult.confidenceScore,
        });
      }
    }

    return { organizationsProcessed: results.length, results };
  }
);
