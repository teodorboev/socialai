import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { createSocialClient } from "@/lib/social/factory";
import type { SocialAccount } from "@prisma/client";
import { processEngagement } from "@/agents/engagement";

export const engagementMonitor = inngest.createFunction(
  {
    id: "engagement-monitor",
    name: "Monitor Engagement",
    retries: 2,
  },
  {
    cron: "*/15 * * * *", // Every 15 minutes
  },
  async ({ step }) => {
    // Get all active social accounts
    const accounts = await step.run("get-active-accounts", async () => {
      return prisma.socialAccount.findMany({
        where: { isActive: true },
        include: {
          organization: {
            include: {
              brandConfig: true,
            },
          },
        },
        take: 20,
      });
    });

    const processedResults = [];

    for (const account of accounts) {
      // Skip if no brand config
      if (!account.organization.brandConfig) {
        continue;
      }

      const result = await step.run(`fetch-engagement-${account.id}`, async () => {
        try {
          const client = createSocialClient(account.platform, {
            ...account,
            accessToken: account.accessToken,
            refreshToken: account.refreshToken || null,
            tokenExpiresAt: account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null,
            createdAt: new Date(account.createdAt),
            updatedAt: new Date(account.updatedAt),
          } as SocialAccount);

          // Fetch comments from recent posts
          // For now, we'll get recent content and check for new comments
          const recentContent = await prisma.content.findMany({
            where: {
              socialAccountId: account.id,
              platformPostId: { not: null },
              status: "PUBLISHED",
            },
            orderBy: { publishedAt: "desc" },
            take: 10,
          });

          const newEngagements = [];

          for (const content of recentContent) {
            if (!content.platformPostId) continue;

            // Get comments from platform
            const comments = await client.getComments(content.platformPostId);

            // Check which ones we haven't seen before
            for (const comment of comments) {
              const existing = await prisma.engagement.findFirst({
                where: {
                  platformEngagementId: comment.id,
                },
              });

              if (!existing) {
                // Create new engagement record
                const engagement = await prisma.engagement.create({
                  data: {
                    organizationId: account.organizationId,
                    socialAccountId: account.id,
                    contentId: content.id,
                    platform: account.platform,
                    engagementType: "COMMENT",
                    platformEngagementId: comment.id,
                    authorName: comment.authorName,
                    authorUsername: comment.authorUsername,
                    body: comment.body,
                    aiResponseStatus: "PENDING",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });

                newEngagements.push(engagement);
              }
            }
          }

          return { success: true, newEngagements: newEngagements.length };
        } catch (error) {
          console.error(`Failed to fetch engagement for account ${account.id}:`, error);
          return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });

      processedResults.push({ accountId: account.id, ...result });
    }

    // Process new engagements
    const allNewEngagements = await step.run("get-all-new-engagements", async () => {
      return prisma.engagement.findMany({
        where: {
          aiResponseStatus: "PENDING",
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 minutes
        },
        take: 20,
      });
    });

    // Process each engagement
    for (const engagement of allNewEngagements) {
      await step.run(`process-engagement-${engagement.id}`, async () => {
        await processEngagement(engagement.organizationId, engagement.id);
      });
    }

    return {
      accountsProcessed: accounts.length,
      engagementsFound: allNewEngagements.length,
      results: processedResults,
    };
  }
);

// Event handler for manual triggers
interface EngagementEvent {
  name: "engagement/new";
  data: {
    organizationId: string;
    engagementId: string;
  };
}

export const onNewEngagement = inngest.createFunction(
  {
    id: "on-new-engagement",
    name: "On New Engagement",
    retries: 2,
  },
  {
    event: "engagement/new",
  },
  async ({ event }: { event: EngagementEvent }) => {
    await processEngagement(event.data.organizationId, event.data.engagementId);
    return { processed: true };
  }
);
