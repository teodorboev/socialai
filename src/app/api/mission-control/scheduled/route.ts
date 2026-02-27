import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mission-control/scheduled
 * 
 * Fetches upcoming scheduled posts.
 * Query params:
 * - days: number (default 7)
 * - platform: string (filter by platform)
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
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "7");
    const platform = searchParams.get("platform");

    const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Build where clause
    const where: any = {
      organizationId: orgId,
      status: "PENDING",
      scheduledFor: {
        gte: new Date(),
        lte: futureDate,
      },
    };

    if (platform) {
      where.socialAccount = { platform: platform.toUpperCase() };
    }

    // Fetch scheduled posts
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        content: {
          select: {
            id: true,
            caption: true,
            contentType: true,
            hashtags: true,
            mediaUrls: true,
          },
        },
        socialAccount: {
          select: {
            platform: true,
            platformUsername: true,
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    });

    // Format response
    const items = schedules.map(schedule => {
      const scheduledTime = new Date(schedule.scheduledFor);
      const now = new Date();
      const isToday = scheduledTime.toDateString() === now.toDateString();
      const isTomorrow = scheduledTime.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

      let timeLabel: string;
      if (isToday) {
        timeLabel = `Today ${scheduledTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      } else if (isTomorrow) {
        timeLabel = `Tomorrow ${scheduledTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      } else {
        timeLabel = scheduledTime.toLocaleDateString("en-US", { 
          weekday: "short", 
          month: "short", 
          day: "numeric",
          hour: "numeric", 
          minute: "2-digit" 
        });
      }

      return {
        id: schedule.id,
        time: schedule.scheduledFor.toISOString(),
        timeLabel,
        platform: formatPlatform(schedule.socialAccount?.platform || "UNKNOWN"),
        platformCode: schedule.socialAccount?.platform || "UNKNOWN",
        contentType: schedule.content?.contentType || "POST",
        preview: schedule.content?.caption?.substring(0, 60) || "No caption",
        hashtags: schedule.content?.hashtags || [],
        mediaCount: schedule.content?.mediaUrls?.length || 0,
      };
    });

    // Group by day
    const groupedByDay: Record<string, typeof items> = {};
    items.forEach(item => {
      const date = new Date(item.time).toDateString();
      if (!groupedByDay[date]) {
        groupedByDay[date] = [];
      }
      groupedByDay[date].push(item);
    });

    return NextResponse.json({
      items,
      groupedByDay,
      count: items.length,
      days,
    });
  } catch (error) {
    console.error("Error fetching scheduled posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 }
    );
  }
}

function formatPlatform(platform: string): string {
  const platformNames: Record<string, string> = {
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    TIKTOK: "TikTok",
    TWITTER: "X (Twitter)",
    LINKEDIN: "LinkedIn",
  };
  return platformNames[platform] || platform;
}
