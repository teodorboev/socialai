import { inngest } from "../client";
import { LocalizationAgent } from "@/agents/localization";
import { prisma } from "@/lib/prisma";

// Event-driven function for localization - triggered when content needs translation
export const localizationPipeline = inngest.createFunction(
  {
    id: "localization-pipeline",
    name: "Localization Pipeline",
    retries: 2,
  },
  {
    event: "content/localize",
  },
  async ({ event, step }) => {
    const { organizationId, contentId, targetLocales } = event.data;

    const org = await step.run("get-org", async () => {
      return prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          brandConfig: true,
          localeConfigs: true,
        },
      });
    });

    if (!org?.brandConfig) {
      return { success: false, error: "Org not found" };
    }

    const content = await step.run("get-content", async () => {
      return prisma.content.findUnique({
        where: { id: contentId },
      });
    });

    if (!content) {
      return { success: false, error: "Content not found" };
    }

    const localizationResult = await step.run("localize-content", async () => {
      const agent = new LocalizationAgent();
      return agent.run(organizationId, {
        organizationId,
        originalContent: {
          caption: content.caption,
          hashtags: content.hashtags,
          platform: content.platform,
        },
        targetLocales: targetLocales || org.localeConfigs?.map((l: any) => l.locale),
        brandName: org.brandConfig?.brandName || "Brand",
      });
    });

    if (localizationResult.success && localizationResult.data) {
      const data = localizationResult.data as any;
      
      // Create localized content versions
      await step.run("save-localizations", async () => {
        for (const localized of data.localizations || []) {
          await prisma.content.create({
            data: {
              organizationId,
              platform: content.platform,
              contentType: content.contentType,
              status: "DRAFT",
              caption: localized.caption,
              hashtags: localized.hashtags,
              confidenceScore: localizationResult.confidenceScore,
              agentNotes: `Localized to ${localized.locale}`,
            },
          });
        }
      });

      return { success: true, localizationsCreated: data.localizations?.length || 0 };
    }

    return { success: false };
  }
);
