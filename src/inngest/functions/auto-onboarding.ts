import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { createSocialClient } from "@/lib/social/factory";
import { smartRouter, type SmartRouterRequest } from "@/lib/router";
import { z } from "zod";

/**
 * Auto-Onboarding Agent
 * 
 * When a new social account is connected, this function:
 * 1. Fetches recent posts from the account (up to 30 days)
 * 2. Uses AI to analyze posts and extract brand voice
 * 3. Auto-generates brand config
 * 4. Creates initial content strategy
 * 5. Creates default posting schedule
 * 6. Triggers initial content generation
 * 
 * This enables fully autonomous onboarding - no manual brand setup needed.
 */

// Schema for AI brand analysis
const BrandAnalysisResultSchema = z.object({
  industry: z.string().describe("Inferred industry from content"),
  voiceTone: z.object({
    adjectives: z.array(z.string()).describe("Adjectives describing brand voice"),
    examples: z.array(z.string()).describe("Example phrases from the brand"),
    avoid: z.array(z.string()).describe("Topics/language to avoid"),
  }),
  contentThemes: z.array(z.string()).describe("Main content themes identified"),
  targetAudience: z.object({
    demographics: z.string().describe("Inferred demographic"),
    interests: z.array(z.string()).describe("Audience interests"),
    painPoints: z.array(z.string()).describe("Audience pain points"),
  }),
  hashtagStrategy: z.object({
    always: z.array(z.string()).describe("Hashtags brand always uses"),
    never: z.array(z.string()).describe("Hashtags brand never uses"),
  }),
  confidenceScore: z.number().min(0).max(1),
});

type BrandAnalysisResult = z.infer<typeof BrandAnalysisResultSchema>;

export const autoOnboarding = inngest.createFunction(
  {
    id: "auto-onboarding",
    name: "Auto Onboarding",
    retries: 3,
  },
  {
    event: "social-account/connected",
  },
  async ({ event, step }) => {
    const { organizationId, socialAccountId } = event.data;

    // Step 1: Get the social account details
    const socialAccount = await step.run("get-social-account", async () => {
      return prisma.socialAccount.findUnique({
        where: { id: socialAccountId },
        include: {
          organization: {
            include: {
              brandConfig: true,
              socialAccounts: { where: { isActive: true } },
            },
          },
        },
      });
    });

    if (!socialAccount) {
      return { success: false, error: "Social account not found" };
    }

    // Skip if brand config already exists
    if (socialAccount.organization.brandConfig) {
      return { success: false, error: "Brand config already exists" };
    }

    const org = socialAccount.organization;

    // Step 2: Fetch recent posts from the platform
    const recentPosts = await step.run("fetch-recent-posts", async () => {
      try {
        // Create a clean object with only the fields needed by the client
        const accountData = {
          id: socialAccount.id,
          platform: socialAccount.platform,
          platformUserId: socialAccount.platformUserId,
          accessToken: socialAccount.accessToken,
          refreshToken: socialAccount.refreshToken || undefined,
          metadata: socialAccount.metadata,
        };
        
        const client = createSocialClient(socialAccount.platform, accountData as any);
        
        const posts = await client.getRecentPosts({
          limit: 30,
          daysBack: 30,
        });

        return posts.map(p => ({
          id: p.id,
          caption: p.caption,
          mediaUrls: p.mediaUrls,
          mediaType: p.mediaType,
          postedAt: p.postedAt instanceof Date ? p.postedAt.toISOString() : p.postedAt,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
        }));
      } catch (error) {
        console.error("Failed to fetch posts:", error);
        return [];
      }
    });

    // Step 3: Fetch profile info
    const profileInfo = await step.run("fetch-profile", async () => {
      try {
        // Create a clean object with only the fields needed by the client
        const accountData = {
          id: socialAccount.id,
          platform: socialAccount.platform,
          platformUserId: socialAccount.platformUserId,
          accessToken: socialAccount.accessToken,
          refreshToken: socialAccount.refreshToken || undefined,
          metadata: socialAccount.metadata,
        };
        
        const client = createSocialClient(socialAccount.platform, accountData as any);
        const profile = await client.getProfile();
        
        return {
          username: profile.username,
          displayName: profile.displayName,
          bio: profile.bio,
          followersCount: profile.followersCount,
          postsCount: profile.postsCount,
        };
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        return null;
      }
    });

    // Step 4: AI Analysis - Extract brand voice from posts
    const aiAnalysis = await step.run("analyze-brand-voice", async () => {
      // If we have posts, use AI to analyze them
      if (recentPosts.length === 0) {
        return null;
      }

      try {
        // Build posts summary for AI
        const postsText = recentPosts
          .slice(0, 15)
          .map((p, i) => {
            let postText = `Post ${i + 1} (${p.likes || 0} likes, ${p.comments || 0} comments):\n${p.caption || "(no caption)"}`;
            if (p.mediaUrls?.length) {
              postText += `\n[Includes media]`;
            }
            return postText;
          })
          .join("\n\n---\n\n");

        const profileText = profileInfo 
          ? `Profile: @${profileInfo.username} (${profileInfo.displayName})\nBio: ${profileInfo.bio || "(none)"}\nFollowers: ${profileInfo.followersCount}\nPosts: ${profileInfo.postsCount}`
          : "Profile: (not available)";

        const systemPrompt = `You are a brand analysis expert. Analyze the social media posts below to extract the brand's voice, style, and audience.

For each brand, identify:
1. Industry (what type of business)
2. Voice & Tone (adjectives describing how they speak, example phrases, what to avoid)
3. Content Themes (main topics they post about)
4. Target Audience (who they're trying to reach)
5. Hashtag Strategy (what hashtags they use, what they avoid)

Respond with a JSON object matching the required schema. Be specific and based only on the evidence in the posts.`;

        const userMessage = `${profileText}

Posts to analyze:
${postsText}

Analyze these posts and extract the brand profile.`;

        const request: SmartRouterRequest = {
          agentName: "ONBOARDING_INTELLIGENCE",
          messages: [{ role: "user", content: userMessage }],
          systemPrompt,
          maxTokens: 2000,
          organizationId,
        };

        const response = await smartRouter.complete(request);

        try {
          const parsed = BrandAnalysisResultSchema.parse(JSON.parse(response.content));
          return parsed;
        } catch {
          console.error("Failed to parse AI response");
          return null;
        }
      } catch (error) {
        console.error("AI analysis failed:", error);
        return null;
      }
    });

    // Step 5: Create brand config based on AI analysis
    const brandConfig = await step.run("create-brand-config", async () => {
      // Use AI analysis if available, otherwise smart defaults
      const voiceTone = aiAnalysis?.voiceTone || {
        adjectives: ["professional", "authentic", "engaging"],
        examples: [],
        avoid: ["controversial topics", "negative language", "spammy behavior"],
      };

      const contentThemes = aiAnalysis?.contentThemes || [
        "product updates",
        "educational content", 
        "behind the scenes",
        "customer stories",
        "industry news",
      ];

      const doNots = aiAnalysis?.voiceTone?.avoid || [
        "spammy behavior",
        "copying competitors directly",
        "controversial opinions",
      ];

      const targetAudience = aiAnalysis?.targetAudience || {
        demographics: "Adults 25-55",
        interests: [],
        painPoints: [],
      };

      const hashtagStrategy = aiAnalysis?.hashtagStrategy || {
        always: [],
        never: [],
        rotating: [],
      };

      const config = {
        brandName: org.name,
        industry: aiAnalysis?.industry || "General",
        voiceTone,
        contentThemes,
        doNots,
        targetAudience,
        hashtagStrategy,
      };

      // Save brand config
      const savedConfig = await prisma.brandConfig.upsert({
        where: { organizationId },
        create: {
          organizationId,
          ...config,
        },
        update: config,
      });

      return savedConfig;
    });

    // Step 6: Generate initial content strategy
    const contentStrategy = await step.run("generate-strategy", async () => {
      const strategy = {
        isAutoGenerated: true,
        basedOnPosts: recentPosts.length,
        aiAnalysisConfidence: aiAnalysis?.confidenceScore,
        recommendedThemes: brandConfig.contentThemes,
        platformPriorities: {} as Record<string, number>,
        postingFrequency: {} as Record<string, number>,
      };

      // Set priorities based on connected accounts
      for (const account of org.socialAccounts) {
        strategy.platformPriorities[account.platform] = 100;
        strategy.postingFrequency[account.platform] = 5;
      }

      // Create content plan
      const plan = await prisma.contentPlan.create({
        data: {
          organizationId,
          title: `Auto-Generated Strategy - ${org.name}`,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          strategy,
          themes: brandConfig.contentThemes || [],
          platformMix: strategy.platformPriorities,
          postsPerWeek: strategy.postingFrequency,
          status: "ACTIVE",
        },
      });

      return plan;
    });

    // Step 7: Create default posting schedule
    const postingSchedule = await step.run("create-schedule", async () => {
      const schedules = [];
      const platforms = [...new Set(org.socialAccounts.map(a => a.platform))];
      
      for (const platform of platforms) {
        // Default schedule: weekdays at 9am, 12pm, 6pm
        for (const day of [1, 2, 3, 4, 5]) {
          for (const time of ["09:00", "12:00", "18:00"]) {
            const schedule = await prisma.postingSchedule.upsert({
              where: {
                organizationId_platform_dayOfWeek_timeUtc: {
                  organizationId,
                  platform,
                  dayOfWeek: day,
                  timeUtc: time,
                },
              },
              create: {
                organizationId,
                platform,
                dayOfWeek: day,
                timeUtc: time,
                isEnabled: true,
              },
              update: {
                isEnabled: true,
              },
            });
            schedules.push(schedule);
          }
        }
      }

      return schedules;
    });

    // Step 8: Trigger initial content generation
    await step.run("trigger-content-generation", async () => {
      await inngest.send({
        name: "content/generate",
        data: {
          organizationId,
          platform: socialAccount.platform,
          reason: "auto-onboarding initial content",
        },
      });

      return { triggered: true };
    });

    return {
      success: true,
      organizationId,
      socialAccountId,
      brandConfigGenerated: !!brandConfig,
      contentStrategyCreated: !!contentStrategy,
      postingScheduleCreated: postingSchedule.length,
      postsAnalyzed: recentPosts.length,
      aiAnalysisUsed: !!aiAnalysis,
    };
  }
);

/**
 * Schedule a check for organizations that have social accounts but no brand config
 */
export const checkPendingOnboarding = inngest.createFunction(
  {
    id: "check-pending-onboarding",
    name: "Check Pending Onboarding",
    retries: 2,
  },
  {
    cron: "0 */4 * * *",
  },
  async ({ step }) => {
    const pendingOrgs = await step.run("find-pending", async () => {
      return prisma.organization.findMany({
        where: {
          socialAccounts: {
            some: { isActive: true },
          },
          brandConfig: null,
        },
        include: {
          socialAccounts: { where: { isActive: true }, take: 1 },
        },
        take: 10,
      });
    });

    const results = [];

    for (const org of pendingOrgs) {
      const result = await step.run(`auto-onboard-${org.id}`, async () => {
        const account = org.socialAccounts[0];
        if (!account) return { success: false, error: "No active account" };

        await inngest.send({
          name: "social-account/connected",
          data: {
            organizationId: org.id,
            socialAccountId: account.id,
          },
        });

        return { success: true, organizationId: org.id };
      });

      results.push(result);
    }

    return { pendingOrganizations: pendingOrgs.length, processed: results.length };
  }
);
