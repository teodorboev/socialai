import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mission-control/wins
 * 
 * Fetches recent wins/achievements:
 * - Viral content (high engagement)
 * - Follower milestones
 * - High click/content posts
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch data for wins detection
    const [
      contentFingerprints,
      analyticsSnapshots,
      highClickContent,
    ] = await Promise.all([
      // Get content with high performance (percentile >= 80)
      prisma.contentFingerprint.findMany({
        where: {
          organizationId: orgId,
          percentileRank: { gte: 80 },
          updatedAt: { gte: sevenDaysAgo },
        },
        orderBy: { percentileRank: "desc" },
        take: 5,
        include: {
          content: {
            select: {
              caption: true,
              platform: true,
              contentType: true,
            },
          },
        },
      }),
      
      // Get follower milestones
      prisma.analyticsSnapshot.findMany({
        where: {
          organizationId: orgId,
          snapshotDate: { gte: sevenDaysAgo },
        },
        orderBy: { snapshotDate: "desc" },
      }),
      
      // Get content with high clicks
      prisma.content.findMany({
        where: {
          organizationId: orgId,
          status: "PUBLISHED",
          publishedAt: { gte: sevenDaysAgo },
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
      }),
    ]);

    const wins: Array<{
      id: string;
      type: "viral" | "followers" | "clicks" | "review" | "conversion";
      description: string;
      icon: string;
      timestamp: string;
    }> = [];

    // Add viral content wins
    for (const fp of contentFingerprints) {
      const engagement = fp.engagementRate || 0;
      const reach = fp.reach || 0;
      
      let description = "";
      if (reach >= 10000) {
        description = `Post hit ${(reach / 1000).toFixed(0)}K views`;
      } else if (engagement >= 10) {
        description = `${engagement.toFixed(1)}% engagement rate achieved`;
      } else {
        description = `Content performing in top 20%`;
      }

      wins.push({
        id: `fp-${fp.id}`,
        type: "viral",
        description,
        icon: "🔥",
        timestamp: fp.updatedAt.toISOString(),
      });
    }

    // Check for follower milestones
    for (const snapshot of analyticsSnapshots) {
      const change = snapshot.followersChange || 0;
      const total = snapshot.followers || 0;
      
      // Check for milestone thresholds
      const milestones = [1000, 5000, 10000, 25000, 50000, 100000];
      for (const milestone of milestones) {
        if (total >= milestone && total - change < milestone) {
          wins.push({
            id: `milestone-${milestone}-${snapshot.id}`,
            type: "followers",
            description: `Hit ${milestone.toLocaleString()} followers!`,
            icon: "💛",
            timestamp: snapshot.snapshotDate.toISOString(),
          });
          break;
        }
      }

      // Add regular follower growth if significant
      if (change >= 50) {
        wins.push({
          id: `growth-${snapshot.id}`,
          type: "followers",
          description: `${change} new followers this week`,
          icon: "💛",
          timestamp: snapshot.snapshotDate.toISOString(),
        });
      }
    }

    // Add high click posts
    const clicksByContent: Record<string, number> = {};
    for (const content of highClickContent) {
      // We'd need clicks tracked - for now use engagement as proxy
      if (content.confidenceScore && content.confidenceScore > 0.85) {
        const key = content.id;
        clicksByContent[key] = (clicksByContent[key] || 0) + 1;
      }
    }

    // Add click wins (if we had actual click tracking)
    // For now, skip this as we don't have click data in Content table

    // Add review wins if any (placeholder - would come from review platform)
    // This would require integrating with Google/Yelp APIs

    // Sort by timestamp (most recent first) and limit
    const sortedWins = wins
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    // If no wins, provide some default context
    if (sortedWins.length === 0) {
      sortedWins.push({
        id: "welcome",
        type: "conversion",
        description: "Welcome to SocialAI! Your first wins are coming soon.",
        icon: "✨",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      wins: sortedWins,
      count: sortedWins.length,
    });
  } catch (error) {
    console.error("Error fetching wins:", error);
    return NextResponse.json(
      { error: "Failed to fetch wins" },
      { status: 500 }
    );
  }
}
