import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mission-control/overview
 * 
 * Fetches main dashboard data for Mission Control:
 * - Metrics (followers, engagement, reach, ROI)
 * - Attention items count
 * - Upcoming scheduled posts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    // Fetch data in parallel
    const [
      latestSnapshot,
      pendingReviews,
      openEscalations,
      upcomingSchedules,
      recentContent,
    ] = await Promise.all([
      // Get latest analytics snapshot
      prisma.analyticsSnapshot.findFirst({
        where: { organizationId: orgId },
        orderBy: { snapshotDate: "desc" },
      }),
      
      // Count pending review content
      prisma.content.count({
        where: { 
          organizationId: orgId,
          status: "PENDING_REVIEW",
        },
      }),
      
      // Count open escalations
      prisma.escalation.count({
        where: { 
          organizationId: orgId,
          status: "OPEN",
        },
      }),
      
      // Get upcoming scheduled posts (next 7 days)
      prisma.schedule.findMany({
        where: {
          organizationId: orgId,
          status: "PENDING",
          scheduledFor: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          content: true,
          socialAccount: true,
        },
        orderBy: { scheduledFor: "asc" },
        take: 10,
      }),
      
      // Get recent published content for engagement calculation
      prisma.content.findMany({
        where: {
          organizationId: orgId,
          status: "PUBLISHED",
          publishedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      }),
    ]);

    // Calculate metrics
    const followers = latestSnapshot?.followers || 0;
    const followersChange = latestSnapshot?.followersChange || 0;
    const engagementRate = latestSnapshot?.engagementRate || 0;
    const reach = latestSnapshot?.reach || 0;
    
    // Calculate average engagement from recent content
    const avgEngagementFromContent = recentContent.length > 0
      ? recentContent.reduce((acc, c) => {
          // Use confidenceScore as a proxy for engagement quality
          return acc + (c.confidenceScore || 0);
        }, 0) / recentContent.length * 100
      : 0;

    // Get ROI from recent costs (simplified - would need attribution in real implementation)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCosts = await prisma.agentCostEvent.aggregate({
      where: {
        organizationId: orgId,
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: {
        costCents: true,
      },
    });
    
    const aiCostThisWeek = (recentCosts._sum.costCents || 0) / 100;
    // Simplified ROI estimate (would need conversion tracking)
    const estimatedReach = reach || recentContent.length * 1000;
    const estimatedValue = estimatedReach * 0.01; // $0.01 per reach estimate
    const roi = aiCostThisWeek > 0 ? estimatedValue - aiCostThisWeek : 0;

    // Format upcoming posts
    const comingUp = upcomingSchedules.map(schedule => ({
      id: schedule.id,
      time: schedule.scheduledFor.toISOString(),
      platform: schedule.socialAccount?.platform || "UNKNOWN",
      contentType: schedule.content?.contentType || "POST",
      preview: schedule.content?.caption?.substring(0, 50) || "",
      scheduledFor: schedule.scheduledFor,
    }));

    // Build response
    const response = {
      metrics: {
        followers: {
          value: followers.toLocaleString(),
          change: (followersChange >= 0 ? "+" : "") + followersChange.toLocaleString(),
          trend: followersChange >= 0 ? "up" as const : "down" as const,
          period: "this week",
        },
        engagement: {
          value: (engagementRate || avgEngagementFromContent).toFixed(1) + "%",
          change: "+0.0%",
          trend: "up" as const,
          period: "this week",
        },
        reach: {
          value: reach >= 1000 ? (reach / 1000).toFixed(1) + "K" : reach.toString(),
          change: "+0K",
          trend: "up" as const,
          period: "this week",
        },
        roi: {
          value: "$" + Math.abs(roi).toFixed(0),
          change: (roi >= 0 ? "+$" : "-$") + Math.abs(roi).toFixed(0),
          trend: roi >= 0 ? "up" as const : "down" as const,
          period: "weekly",
        },
      },
      attentionItems: {
        count: pendingReviews + openEscalations,
        pendingReviews,
        openEscalations,
      },
      comingUp: {
        count: upcomingSchedules.length,
        items: comingUp,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching mission control overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview data" },
      { status: 500 }
    );
  }
}
