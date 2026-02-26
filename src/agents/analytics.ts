import { BaseAgent, type OrgContext } from "./shared/base-agent";
import type { AgentName, Platform } from "@prisma/client";
import { AnalyticsReportSchema, type AnalyticsReport } from "@/lib/ai/schemas/analytics";
import { buildAnalyticsPrompt } from "@/lib/ai/prompts/analytics";
import { loadPrompt } from "@/lib/ai/prompts/loader";

interface SnapshotInput {
  organizationId: string;
  platform: Platform;
  socialAccountId: string;
  metrics: {
    followers: number;
    impressions: number;
    reach: number;
    engagementRate: number;
    clicks: number;
    shares: number;
    saves: number;
  };
}

interface ReportInput {
  organizationId: string;
  brandName: string;
  periodDays: number;
  snapshots: Array<{
    platform: string;
    followers: number;
    followersChange: number;
    impressions: number;
    reach: number;
    engagementRate: number;
    clicks: number;
    shares: number;
    saves: number;
    snapshotDate: Date;
  }>;
  contentPerformance: Array<{
    contentId: string;
    platform: string;
    contentType: string;
    caption: string;
    impressions: number;
    engagement: number;
    engagementRate: number;
    clicks: number;
    shares: number;
    saves: number;
    publishedAt: Date;
  }>;
  previousRecommendations?: string[];
}

// Data collection mode - no LLM, just API calls
export async function collectMetrics(
  organizationId: string,
  socialAccountId: string,
  platform: Platform
): Promise<SnapshotInput | null> {
  // This would be called from Inngest to collect metrics from platform APIs
  // For now, returning null as it requires platform API integration
  return null;
}

// Report generation mode - uses LLM
export class AnalyticsAgent extends BaseAgent {
  constructor() {
    super("ANALYTICS");
    this.setTaskType("analysis");
  }

  async execute(input: ReportInput) {
    const { brandName, periodDays, snapshots, contentPerformance, previousRecommendations, organizationId } = input;

    // Load prompt from DB
    let systemPrompt: string;
    try {
      systemPrompt = await loadPrompt("ANALYTICS", "main", {
        brandName,
        periodDays: String(periodDays),
        snapshots: JSON.stringify(snapshots),
        contentPerformance: JSON.stringify(contentPerformance),
        previousRecommendations: previousRecommendations ? JSON.stringify(previousRecommendations) : "",
      }, organizationId);
    } catch {
      // Fallback to hardcoded prompt if DB fails
      systemPrompt = buildAnalyticsPrompt({
        brandName,
        periodDays,
        snapshots: snapshots.map(s => ({ ...s, snapshotDate: s.snapshotDate.toString() })),
        contentPerformance: contentPerformance.map(c => ({ ...c, publishedAt: c.publishedAt.toString() })),
        previousRecommendations,
      });
    }

    const { text, tokensUsed, inputTokens, outputTokens } = await this.callLLM({
      system: systemPrompt,
      userMessage: "Generate the analytics report for this period.",
      maxTokens: 4000,
      organizationId,
    });

    // Parse the JSON response
    let parsed: AnalyticsReport;
    try {
      if (!text) {
        throw new Error("No text response from Claude");
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = AnalyticsReportSchema.parse(JSON.parse(jsonMatch[0]));
    } catch (parseError) {
      console.error("Failed to parse analytics report:", parseError, text);
      return {
        success: false,
        confidenceScore: 0,
        shouldEscalate: true,
        escalationReason: "Failed to parse AI response",
        tokensUsed,
        inputTokens,
        outputTokens,
      };
    }

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.6,
      tokensUsed,
      inputTokens,
      outputTokens,
    };
  }
}

// Generate a weekly report for an organization
export async function generateWeeklyReport(organizationId: string): Promise<void> {
  // Fetch organization and brand config
  const organization = await import("@/lib/prisma").then((prisma) =>
    prisma.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { brandConfig: true },
    })
  );

  if (!organization || !organization.brandConfig) {
    console.error(`Organization ${organizationId} not found or no brand config`);
    return;
  }

  // Get snapshots for the last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const snapshots = await import("@/lib/prisma").then((prisma) =>
    prisma.prisma.analyticsSnapshot.findMany({
      where: {
        organizationId,
        snapshotDate: { gte: weekAgo },
      },
      orderBy: { snapshotDate: "asc" },
    })
  );

  // Get content performance for the last 7 days
  const contentPerformance = await import("@/lib/prisma").then((prisma) =>
    prisma.prisma.content.findMany({
      where: {
        organizationId,
        status: "PUBLISHED",
        publishedAt: { gte: weekAgo },
      },
      select: {
        id: true,
        platform: true,
        contentType: true,
        caption: true,
        publishedAt: true,
      },
    })
  );

  // Get previous recommendations
  const previousContentPlan = await import("@/lib/prisma").then((prisma) =>
    prisma.prisma.contentPlan.findFirst({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { periodStart: "desc" },
    })
  );

  const agent = new AnalyticsAgent();

  try {
    const result = await agent.run(organizationId, {
      organizationId,
      brandName: organization.brandConfig.brandName,
      periodDays: 7,
      snapshots: snapshots.map((s) => ({
        platform: s.platform,
        followers: s.followers || 0,
        followersChange: s.followersChange || 0,
        impressions: s.impressions || 0,
        reach: s.reach || 0,
        engagementRate: s.engagementRate || 0,
        clicks: s.clicks || 0,
        shares: s.shares || 0,
        saves: s.saves || 0,
        snapshotDate: s.snapshotDate,
      })),
      contentPerformance: contentPerformance.map((c) => ({
        contentId: c.id,
        platform: c.platform,
        contentType: c.contentType,
        caption: c.caption,
        impressions: 0, // Would need to join with analytics
        engagement: 0,
        engagementRate: 0,
        clicks: 0,
        shares: 0,
        saves: 0,
        publishedAt: c.publishedAt!,
      })),
      previousRecommendations: previousContentPlan
        ? ((previousContentPlan.strategy as any)?.recommendations?.map((r: any) => r.recommendation) || [])
        : undefined,
    });

    if (result.success && result.data) {
      const report = result.data as AnalyticsReport;

      // Store the report (could be in a separate table or as JSON)
      console.log("Generated report:", report.summary);

      // Update the content plan with recommendations for other agents
      if (previousContentPlan && report.recommendations?.length) {
        await import("@/lib/prisma").then((prisma) =>
          prisma.prisma.contentPlan.update({
            where: { id: previousContentPlan.id },
            data: {
              strategy: {
                ...(previousContentPlan.strategy as object),
                recommendations: report.recommendations,
              },
            },
          })
        );
      }

      // Get owner email for report
      const owner = await import("@/lib/prisma").then((prisma) =>
        prisma.prisma.orgMember.findFirst({
          where: { organizationId, role: "OWNER" },
          include: { organization: false },
        })
      );

      if (owner) {
        // Get user email from auth
        const { data: userData } = await import("@/lib/supabase/admin").then((supabase) =>
          supabase.supabaseAdmin.auth.admin.getUserById(owner.userId)
        );
        
        if (userData?.user?.email) {
          const { sendWeeklyReportEmail } = await import("@/lib/email");
          await sendWeeklyReportEmail(
            userData.user.email,
            {
              summary: report.summary,
              totalImpressions: report.metrics.totalImpressions,
              totalEngagements: report.metrics.totalEngagements,
              bestPerformingPlatform: report.metrics.bestPerformingPlatform,
            },
            organization.brandConfig.brandName
          );
        }
      }
    }
  } catch (error) {
    console.error(`Failed to generate report for org ${organizationId}:`, error);
  }
}
