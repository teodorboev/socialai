import { inngest } from "../client";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { CreativeDirectorAgent } from "@/agents/creative-director";
import { prisma } from "@/lib/prisma";
import { resolveAction, getContentStatusFromAction, DEFAULT_THRESHOLDS } from "@/agents/shared/confidence";

export const contentPipeline = inngest.createFunction(
  {
    id: "content-pipeline",
    name: "Content Pipeline",
    retries: 3,
  },
  {
    cron: "0 */6 * * *", // Every 6 hours
  },
  async ({ step }) => {
    // Step 1: Get all active organizations that need content
    const organizations = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" }, // Only paid plans
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          contentPlans: {
            where: { status: "ACTIVE" },
            orderBy: { periodStart: "desc" },
            take: 1,
          },
          orgSettings: true,
        },
        take: 10, // Process max 10 orgs at a time
      });
    });

    const results = [];

    // Step 2: Generate content for each org
    for (const org of organizations) {
      const brandConfig = org.brandConfig;
      if (!brandConfig || org.socialAccounts.length === 0) {
        continue;
      }

      const orgResult = await step.run(`generate-content-${org.id}`, async () => {
        const account = org.socialAccounts[0]; // Use first active account
        const thresholds = org.orgSettings
          ? {
              autoExecute: org.orgSettings.autoPublishThreshold,
              flagForReview: org.orgSettings.flagForReviewThreshold,
              requireReview: org.orgSettings.requireReviewThreshold,
            }
          : DEFAULT_THRESHOLDS;

        const agent = new ContentCreatorAgent();
        const result = await agent.run(org.id, {
          organizationId: org.id,
          platform: account.platform,
          brandConfig: {
            brandName: brandConfig.brandName,
            voiceTone: brandConfig.voiceTone as any,
            contentThemes: brandConfig.contentThemes,
            doNots: brandConfig.doNots,
            targetAudience: brandConfig.targetAudience as any,
            hashtagStrategy: brandConfig.hashtagStrategy as any,
          },
          contentPlanContext: org.contentPlans[0]?.strategy
            ? JSON.stringify(org.contentPlans[0].strategy)
            : undefined,
        });

        if (!result.success || !result.data) {
          return { success: false, error: result.escalationReason };
        }

        const content = result.data as any;
        const action = resolveAction(result.confidenceScore, thresholds);
        const status = getContentStatusFromAction(action);

        // Check if we're at the daily limit
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const postsToday = await prisma.content.count({
          where: {
            organizationId: org.id,
            socialAccountId: account.id,
            createdAt: { gte: todayStart },
          },
        });

        const maxPostsPerDay = thresholds.autoExecute ? 3 : 10; // Default limits
        if (postsToday >= maxPostsPerDay) {
          return { success: false, error: "Daily limit reached" };
        }

        // Save content
        const savedContent = await prisma.content.create({
          data: {
            organizationId: org.id,
            socialAccountId: account.id,
            platform: account.platform,
            contentType: content.contentType,
            status,
            caption: content.caption,
            hashtags: content.hashtags,
            altText: content.altText,
            confidenceScore: result.confidenceScore,
            agentNotes: content.reasoning,
            contentPlanId: org.contentPlans[0]?.id,
          },
        });

        // Step 3: Generate visuals with Creative Director
        let hasVisuals = false;
        try {
          const visualAgent = new CreativeDirectorAgent();
          const visualResult = await visualAgent.run(org.id, {
            organizationId: org.id,
            contentId: savedContent.id,
            caption: content.caption,
            contentType: content.contentType,
            platform: account.platform,
          });
          hasVisuals = !!(visualResult as { data?: { visuals?: unknown[] } })?.data?.visuals?.length;
        } catch (error) {
          console.error("Visual generation failed:", error);
          // Continue even if visual generation fails - content is still valid
        }

        return {
          success: true,
          contentId: savedContent.id,
          status,
          confidenceScore: result.confidenceScore,
          hasVisuals,
        };
      });

      results.push({ orgId: org.id, ...orgResult });
    }

    return { organizationsProcessed: results.length, results };
  }
);

// Event-driven: Generate content when trend is detected
export const onUrgentTrend = inngest.createFunction(
  {
    id: "on-urgent-trend",
    name: "On Urgent Trend",
    retries: 2,
  },
  {
    event: "trend/urgent",
  },
  async ({ event, step }) => {
    const { organizationId, trend } = event.data;

    const org = await step.run("get-org", async () => {
      return prisma.organization.findUnique({
        where: { id: organizationId },
        include: { brandConfig: true, socialAccounts: { where: { isActive: true }, take: 1 } },
      });
    });

    if (!org?.brandConfig || !org.socialAccounts[0]) {
      return { success: false, error: "Org not ready" };
    }

    const brandConfig = org.brandConfig;
    const account = org.socialAccounts[0];

    const result = await step.run("generate-trend-content", async () => {
      const agent = new ContentCreatorAgent();
      return agent.run(organizationId, {
        organizationId,
        platform: account.platform,
        brandConfig: {
          brandName: brandConfig.brandName,
          voiceTone: brandConfig.voiceTone as any,
          contentThemes: brandConfig.contentThemes,
          doNots: brandConfig.doNots,
          targetAudience: brandConfig.targetAudience as any,
          hashtagStrategy: brandConfig.hashtagStrategy as any,
        },
        trendContext: `URGENT TREND: ${trend}`,
      });
    });

    if (!result.success || !result.data) {
      return { success: false };
    }

    // Auto-approve if confidence is high enough
    const content = result.data as any;
    const status = result.confidenceScore >= 0.85 ? "APPROVED" : "PENDING_REVIEW";

    await step.run("save-content", async () => {
      await prisma.content.create({
        data: {
          organizationId,
          socialAccountId: account.id,
          platform: account.platform,
          contentType: content.contentType,
          status,
          caption: content.caption,
          hashtags: content.hashtags,
          confidenceScore: result.confidenceScore,
          agentNotes: `${content.reasoning} (Trend: ${trend})`,
        },
      });
    });

    return { success: true, status };
  }
);
