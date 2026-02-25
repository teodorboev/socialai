import { inngest } from "../client";
import { BrandVoiceGuardianAgent } from "@/agents/brand-voice-guardian";
import { prisma } from "@/lib/prisma";

export const voiceGuardian = inngest.createFunction(
  {
    id: "voice-guardian",
    name: "Brand Voice Guardian",
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
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
        },
        take: 30,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.brandConfig) continue;

      // Get recent content for analysis
      const recentContent = await step.run(`get-recent-content-${org.id}`, async () => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        return prisma.content.findMany({
          where: {
            organizationId: org.id,
            status: { in: ["PUBLISHED", "APPROVED"] },
            createdAt: { gte: weekAgo },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });
      });

      if (recentContent.length < 3) continue;

      const guardianResult = await step.run(`check-voice-${org.id}`, async () => {
        const agent = new BrandVoiceGuardianAgent();
        return agent.run(org.id, {
          organizationId: org.id,
          brandConfig: org.brandConfig ? {
            brandName: org.brandConfig.brandName,
            voiceTone: org.brandConfig.voiceTone as any,
            doNots: org.brandConfig.doNots,
          } : { brandName: "Brand", voiceTone: {}, doNots: [] },
          recentContent: recentContent.map((c: any) => ({
            id: c.id,
            caption: c.caption,
            platform: c.platform,
            publishedAt: c.publishedAt,
          })),
        });
      });

      if (guardianResult.success && guardianResult.data) {
        const data = guardianResult.data as any;

        if (data.violations?.length > 0) {
          // Log violations for review
          await step.run(`log-violations-${org.id}`, async () => {
            await prisma.agentLog.create({
              data: {
                organizationId: org.id,
                agentName: "BRAND_VOICE_GUARDIAN",
                action: "Voice Check",
                inputSummary: { contentCount: recentContent.length },
                outputSummary: { violations: data.violations },
                confidenceScore: guardianResult.confidenceScore,
                status: guardianResult.shouldEscalate ? "ESCALATED" : "SUCCESS",
              },
            });
          });
        }

        results.push({ orgId: org.id, violations: data.violations?.length || 0, score: data.overallScore });
      }
    }

    return { organizationsChecked: results.length, violationsFound: results.reduce((sum: number, r: any) => sum + r.violations, 0) };
  }
);
