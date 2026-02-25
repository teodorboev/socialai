import { inngest } from "../client";
import { CreativeDirectorAgent } from "@/agents/creative-director";
import { prisma } from "@/lib/prisma";

export const visualPipeline = inngest.createFunction(
  {
    id: "visual-pipeline",
    name: "Visual Pipeline",
    retries: 3,
  },
  {
    cron: "0 */4 * * *", // Every 4 hours
  },
  async ({ step }) => {
    // Get all content that needs visuals but doesn't have them yet
    const contentNeedingVisuals = await step.run("get-content-needing-visuals", async () => {
      return prisma.content.findMany({
        where: {
          status: { in: ["APPROVED", "SCHEDULED", "PENDING_REVIEW"] },
          mediaUrls: { isEmpty: true },
        },
        include: {
          socialAccount: true,
        },
        take: 20,
      });
    });

    // Get brand configs for all organizations at once
    const orgIds = [...new Set(contentNeedingVisuals.map((c: any) => c.organizationId))];
    const brandConfigs = await prisma.brandConfig.findMany({
      where: { organizationId: { in: orgIds } },
    });
    const brandConfigMap = new Map(brandConfigs.map((bc: any) => [bc.organizationId, bc]));

    const results = [];

    for (const content of contentNeedingVisuals) {
      const result = await step.run(`generate-visual-${content.id}`, async () => {
        try {
          const brandConfig = brandConfigMap.get(content.organizationId);
          if (!brandConfig) {
            return { success: false, error: "No brand config" };
          }

          const agent = new CreativeDirectorAgent();
          const visualResult = await agent.run(content.organizationId, {
            organizationId: content.organizationId,
            contentId: content.id,
            caption: content.caption,
            contentType: content.contentType,
            platform: content.platform,
          });

          if (!visualResult.success || !visualResult.data) {
            return { success: false, error: visualResult.escalationReason };
          }

          const visuals = visualResult.data as { 
            visuals?: Array<{ storageUrl?: string; altText?: string }> 
          };
          const mediaUrls = visuals.visuals
            ?.filter((v) => v.storageUrl)
            .map((v) => v.storageUrl!) || [];

          // Update content with generated media URLs
          await prisma.content.update({
            where: { id: content.id },
            data: {
              mediaUrls,
              mediaType: content.contentType === "CAROUSEL" ? "CAROUSEL_IMAGES" : "IMAGE",
              altText: visuals.visuals?.[0]?.altText || content.caption.substring(0, 125),
            },
          });

          return {
            success: true,
            contentId: content.id,
            mediaUrlsGenerated: mediaUrls.length,
            confidenceScore: visualResult.confidenceScore,
          };
        } catch (error) {
          console.error(`Failed to generate visual for content ${content.id}:`, error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });

      results.push({ contentId: content.id, ...result });
    }

    return { contentProcessed: contentNeedingVisuals.length, results };
  }
);

// Event-driven: Generate visuals when new approved content is created
export const onContentApprovedForVisual = inngest.createFunction(
  {
    id: "on-content-approved-for-visual",
    name: "On Content Approved For Visual",
    retries: 2,
  },
  {
    event: "content/approved.for-visual",
  },
  async ({ event, step }) => {
    const { contentId } = event.data;

    const content = await step.run("get-content", async () => {
      return prisma.content.findUnique({
        where: { id: contentId },
        include: {
          socialAccount: true,
          organization: {
            include: { brandConfig: true },
          },
        },
      });
    });

    if (!content || !content.organization.brandConfig) {
      return { success: false, error: "Content or brand config not found" };
    }

    const result = await step.run("generate-visual", async () => {
      const agent = new CreativeDirectorAgent();
      return agent.run(content.organizationId, {
        organizationId: content.organizationId,
        contentId: content.id,
        caption: content.caption,
        contentType: content.contentType,
        platform: content.platform,
      });
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.escalationReason };
    }

    const visuals = result.data as { visuals?: Array<{ storageUrl?: string }> };
    const mediaUrls = visuals.visuals
      ?.filter((v) => v.storageUrl)
      .map((v) => v.storageUrl!) || [];

    await step.run("update-content", async () => {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          mediaUrls,
          mediaType: content.contentType === "CAROUSEL" ? "CAROUSEL_IMAGES" : "IMAGE",
        },
      });
    });

    return { success: true, mediaUrlsGenerated: mediaUrls.length };
  }
);
