import { inngest } from "../client";
import { InfluencerScoutAgent } from "@/agents/influencer-scout";
import { prisma } from "@/lib/prisma";

/**
 * Influencer Scout Scan - Weekly scan for potential influencer partners
 * Runs every Wednesday at 5am (same as competitor intel)
 */
export const influencerScan = inngest.createFunction(
  {
    id: "influencer-scan",
    name: "Influencer Scout Scan",
    retries: 2,
  },
  {
    cron: "0 5 * * 3", // Every Wednesday at 5am
  },
  async ({ step }) => {
    // Get organizations with social accounts
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: { plan: { not: "STARTER" } },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
        },
        take: 10,
      });
    });

    const results = [];

    for (const org of organizations) {
      if (!org.brandConfig || org.socialAccounts.length === 0) continue;

      const result = await step.run(`scan-${org.id}`, async () => {
        const agent = new InfluencerScoutAgent();

        // Get existing candidates to avoid duplicates
        const existingHandles = await prisma.influencerCandidate.findMany({
          where: { organizationId: org.id },
          select: { handle: true, platform: true },
        });

        const existingSet = new Set(existingHandles.map((e: any) => `${e.platform}:${e.handle}`));

        // Generate mock candidate data (in production, this would come from platform APIs)
        const candidateData = Array.from({ length: 10 }, (_, i) => ({
          name: `Creator ${i + 1}`,
          handle: `creator_${i + 1}`,
          platform: org.socialAccounts[i % org.socialAccounts.length]?.platform || "INSTAGRAM",
          followers: Math.floor(Math.random() * 50000) + 1000,
          avgEngagementRate: Math.random() * 8 + 1,
          avgLikes: Math.floor(Math.random() * 5000) + 100,
          avgComments: Math.floor(Math.random() * 200) + 10,
          postFrequency: Math.random() > 0.5 ? "weekly" : "monthly",
          topContentTypes: ["POST", "REEL", "CAROUSEL"].slice(0, Math.floor(Math.random() * 3) + 1),
        })).filter((c) => !existingSet.has(`${c.platform}:${c.handle}`));

        if (candidateData.length === 0) {
          return { success: true, data: { candidates: [], summary: { totalScanned: 0, qualifiedCandidates: 0 } } };
        }

        const brandConfig = org.brandConfig;
        if (!brandConfig) {
          return { success: false, error: "No brand config" };
        }

        return agent.run(org.id, {
          organizationId: org.id,
          brandConfig: {
            brandName: brandConfig.brandName,
            industry: brandConfig.industry || "general",
            targetAudience: (brandConfig.targetAudience as any) || { demographics: "general", interests: [] },
          },
          candidateData,
        });
      });

      if (result.success && "data" in result && result.data) {
        const data = result.data as any;

        // Save candidates to database
        if (data.candidates?.length > 0) {
          await step.run(`save-candidates-${org.id}`, async () => {
            for (const candidate of data.candidates) {
              await prisma.influencerCandidate.create({
                data: {
                  organizationId: org.id,
                  name: candidate.name,
                  handle: candidate.handle,
                  platform: candidate.platform,
                  followers: candidate.followers,
                  tier: candidate.tier,
                  authenticityScore: candidate.scores.authenticityScore,
                  relevanceScore: candidate.scores.relevanceScore,
                  overallFitScore: candidate.scores.overallFit,
                  metrics: candidate.metrics,
                  redFlags: candidate.redFlags || [],
                  relationship: candidate.existingRelationship,
                  outreachStatus: "identified",
                },
              });
            }
          });
        }
      }

      // Always escalate - human must review influencers
      const resultData = "data" in result && result.data ? result.data as any : null;
      await step.run(`escalate-${org.id}`, async () => {
        await prisma.escalation.create({
          data: {
            organizationId: org.id,
            agentName: "INFLUENCER_SCOUT",
            reason: `Found ${resultData?.candidates?.length || 0} new influencer candidates - human review required`,
            context: resultData,
            priority: "MEDIUM",
            status: "OPEN",
          },
        });
      });

      results.push({ orgId: org.id, candidates: resultData?.candidates?.length || 0 });
    }

    return { organizationsScanned: results.length, results };
  }
);
