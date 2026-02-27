import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mission-control/notifications
 * 
 * Fetches notifications for the user:
 * - Urgent escalations (CRITICAL, HIGH priority)
 * - Content pending review
 * - Weekly reports
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

    // Fetch notifications from different sources
    const [
      criticalEscalations,
      highPriorityEscalations,
      pendingContent,
      weeklyReport,
    ] = await Promise.all([
      // Critical escalations
      prisma.escalation.findMany({
        where: {
          organizationId: orgId,
          status: "OPEN",
          priority: "CRITICAL",
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      
      // High priority escalations
      prisma.escalation.findMany({
        where: {
          organizationId: orgId,
          status: "OPEN",
          priority: "HIGH",
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      
      // Content ready for review
      prisma.content.count({
        where: {
          organizationId: orgId,
          status: "PENDING_REVIEW",
        },
      }),
      
      // Check if weekly report exists (last 7 days)
      prisma.agentLog.findFirst({
        where: {
          organizationId: orgId,
          action: "WEEKLY_REPORT",
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const notifications: Array<{
      id: string;
      type: "escalation" | "crisis" | "content_ready" | "weekly_report" | "milestone";
      title: string;
      message: string;
      read: boolean;
      createdAt: string;
      actionUrl?: string;
      actionLabel?: string;
      priority: "urgent" | "normal";
    }> = [];

    const now = new Date();

    // Add critical escalations (urgent)
    for (const e of criticalEscalations) {
      const timeAgo = getTimeAgo(e.createdAt, now);
      notifications.push({
        id: `escalation-critical-${e.id}`,
        type: "crisis",
        title: "Critical: " + truncate(e.reason, 40),
        message: e.reason,
        read: false,
        createdAt: timeAgo,
        actionUrl: `/dashboard/escalations?id=${e.id}`,
        actionLabel: "View",
        priority: "urgent",
      });
    }

    // Add high priority escalations (urgent)
    for (const e of highPriorityEscalations) {
      const timeAgo = getTimeAgo(e.createdAt, now);
      notifications.push({
        id: `escalation-high-${e.id}`,
        type: "escalation",
        title: "Escalation: " + truncate(e.reason, 40),
        message: e.reason,
        read: false,
        createdAt: timeAgo,
        actionUrl: `/dashboard/escalations?id=${e.id}`,
        actionLabel: "Review",
        priority: "urgent",
      });
    }

    // Add pending content notification
    if (pendingContent > 0) {
      notifications.push({
        id: "content-pending",
        type: "content_ready",
        title: `${pendingContent} post${pendingContent > 1 ? "s" : ""} ready for review`,
        message: pendingContent > 1 
          ? `Approve ${pendingContent} posts before they're scheduled.`
          : "One post is waiting for your approval.",
        read: pendingContent < 3, // Mark as read if only a few
        createdAt: "Recently",
        actionUrl: "/dashboard/review",
        actionLabel: "Preview & Approve",
        priority: pendingContent > 5 ? "urgent" : "normal",
      });
    }

    // Add weekly report notification if exists
    if (weeklyReport) {
      notifications.push({
        id: "weekly-report",
        type: "weekly_report",
        title: "Weekly performance report ready",
        message: "See how your content performed last week.",
        read: true,
        createdAt: getTimeAgo(weeklyReport.createdAt, now),
        actionUrl: "/dashboard/analytics",
        actionLabel: "View Report",
        priority: "normal",
      });
    }

    // Sort: urgent first, then by recency
    const priorityOrder = { urgent: 0, normal: 1 };
    notifications.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return 0; // Keep original order for same priority
    });

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({
      notifications,
      unreadCount,
      counts: {
        urgent: notifications.filter(n => n.priority === "urgent").length,
        total: notifications.length,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

function getTimeAgo(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + "...";
}
