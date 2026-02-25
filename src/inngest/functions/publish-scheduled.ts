import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { createSocialClient } from "@/lib/social/factory";
import type { SocialAccount, Content } from "@prisma/client";

export const publishScheduled = inngest.createFunction(
  {
    id: "publish-scheduled",
    name: "Publish Scheduled Content",
    retries: 3,
  },
  {
    cron: "*/5 * * * *", // Every 5 minutes
  },
  async ({ step }) => {
    // Get all pending schedules that are due
    const dueSchedules = await step.run("get-due-schedules", async () => {
      return prisma.schedule.findMany({
        where: {
          status: "PENDING",
          scheduledFor: { lte: new Date() },
        },
        include: {
          content: true,
          socialAccount: true,
        },
        take: 10,
      });
    });

    const results = [];

    for (const schedule of dueSchedules) {
      const result = await step.run(`publish-${schedule.id}`, async () => {
        try {
          // Update status to publishing
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { status: "PUBLISHING" },
          });

          const client = createSocialClient(
            schedule.content.platform,
            {
              ...schedule.socialAccount,
              accessToken: schedule.socialAccount.accessToken,
              refreshToken: schedule.socialAccount.refreshToken || null,
              tokenExpiresAt: schedule.socialAccount.tokenExpiresAt 
                ? new Date(schedule.socialAccount.tokenExpiresAt) 
                : null,
              createdAt: new Date(schedule.socialAccount.createdAt),
              updatedAt: new Date(schedule.socialAccount.updatedAt),
            } as SocialAccount
          );

          // Publish
          const publishResult = await client.publish({
            caption: schedule.content.caption,
            mediaUrls: (schedule.content.mediaUrls as string[]) || undefined,
            mediaType: schedule.content.mediaType as any,
            contentType: schedule.content.contentType,
            altText: schedule.content.altText || undefined,
            linkUrl: schedule.content.linkUrl || undefined,
          });

          // Update both schedule and content
          await prisma.$transaction([
            prisma.schedule.update({
              where: { id: schedule.id },
              data: {
                status: "PUBLISHED",
                publishedAt: new Date(),
              },
            }),
            prisma.content.update({
              where: { id: schedule.contentId },
              data: {
                status: "PUBLISHED",
                platformPostId: publishResult.platformPostId,
                publishedAt: new Date(),
              },
            }),
          ]);

          return { success: true, postId: publishResult.platformPostId };
        } catch (error) {
          // Increment retry count
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: {
              status: "FAILED",
              retryCount: { increment: 1 },
              lastError: error instanceof Error ? error.message : "Unknown error",
            },
          });

          return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
      });

      results.push({ scheduleId: schedule.id, ...result });
    }

    return { processed: results.length, results };
  }
);
