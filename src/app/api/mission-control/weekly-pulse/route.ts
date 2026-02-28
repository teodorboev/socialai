import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { smartRouter, type SmartRouterRequest } from "@/lib/router";

/**
 * GET /api/mission-control/weekly-pulse
 * 
 * AI-generated weekly summary using SmartRouter with analytics tools.
 * This provides a dynamic, narrative summary of the week's performance.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const orgId = orgMember.organization_id;

    // Fetch analytics data for the week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      analyticsSnapshots,
      content,
      escalations,
      schedules,
      brandConfig,
    ] = await Promise.all([
      prisma.analyticsSnapshot.findMany({
        where: {
          organizationId: orgId,
          snapshotDate: { gte: weekAgo },
        },
        orderBy: { snapshotDate: "desc" },
      }),

      prisma.content.findMany({
        where: {
          organizationId: orgId,
          publishedAt: { gte: weekAgo },
        },
        orderBy: { publishedAt: "desc" },
      }),

      prisma.escalation.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: weekAgo },
        },
      }),

      prisma.schedule.findMany({
        where: {
          organizationId: orgId,
          scheduledFor: { gte: weekAgo },
        },
        include: {
          content: true,
          socialAccount: true,
        },
      }),

      prisma.brandConfig.findUnique({
        where: { organizationId: orgId },
      }),
    ]);

    // Calculate metrics
    const totalImpressions = analyticsSnapshots.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalReach = analyticsSnapshots.reduce((sum, a) => sum + (a.reach || 0), 0);
    const avgEngagementRate = analyticsSnapshots.length > 0
      ? analyticsSnapshots.reduce((sum, a) => sum + (a.engagementRate || 0), 0) / analyticsSnapshots.length
      : 0;
    const totalFollowerChange = analyticsSnapshots.reduce((sum, a) => sum + (a.followersChange || 0), 0);

    const publishedContent = content.filter(c => c.status === "PUBLISHED");
    const scheduledContent = content.filter(c => c.status === "SCHEDULED");
    const pendingReview = content.filter(c => c.status === "PENDING_REVIEW");

    const platformBreakdown: Record<string, number> = {};
    for (const c of publishedContent) {
      platformBreakdown[c.platform] = (platformBreakdown[c.platform] || 0) + 1;
    }

    // Use SmartRouter to generate a narrative summary
    const systemPrompt = `You are a social media analyst. Generate a concise weekly performance summary.

BRAND: ${brandConfig?.brandName || "Your Brand"}
INDUSTRY: ${brandConfig?.industry || "General"}

WEEKLY METRICS:
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Reach: ${totalReach.toLocaleString()}
- Avg Engagement Rate: ${avgEngagementRate.toFixed(2)}%
- Follower Change: ${totalFollowerChange >= 0 ? "+" : ""}${totalFollowerChange}
- Published Posts: ${publishedContent.length}
- Scheduled Posts: ${scheduledContent.length}
- Pending Review: ${pendingReview.length}
- Escalations: ${escalations.length}

PLATFORM BREAKDOWN:
${Object.entries(platformBreakdown).map(([platform, count]) => `- ${platform}: ${count} posts`).join("\n") || "No posts published"}

CONTENT PERFORMANCE:
${publishedContent.slice(0, 5).map((c, i) => {
      const engagement = c.confidenceScore ? (c.confidenceScore * 100).toFixed(0) : "N/A";
      return `${i + 1}. ${c.platform} ${c.contentType}: "${c.caption?.substring(0, 50)}..." (score: ${engagement}%)`;
    }).join("\n") || "No content data"}

Generate a concise, human-readable weekly pulse summary (2-3 sentences). 
Focus on:
1. Key wins/improvements this week
2. Any concerns or areas needing attention
3. Actionable recommendation for next week

Keep it conversational and motivating.`;

    const routerRequest: SmartRouterRequest = {
      agentName: "ANALYTICS",
      messages: [{ role: "user", content: "Generate the weekly pulse summary" }],
      systemPrompt,
      maxTokens: 500,
      organizationId: orgId,
    };

    const response = await smartRouter.complete(routerRequest);

    // Get the brand name for the response
    const brandName = brandConfig?.brandName || "Your Brand";

    return NextResponse.json({
      pulse: response.content,
      brandName,
      weekOf: weekAgo.toISOString(),
      metrics: {
        impressions: totalImpressions,
        reach: totalReach,
        engagementRate: avgEngagementRate.toFixed(2),
        followerChange: totalFollowerChange,
        publishedCount: publishedContent.length,
        scheduledCount: scheduledContent.length,
        pendingReviewCount: pendingReview.length,
        escalationsCount: escalations.length,
      },
      platformBreakdown,
    });
  } catch (error) {
    console.error("Error generating weekly pulse:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly pulse" },
      { status: 500 }
    );
  }
}
