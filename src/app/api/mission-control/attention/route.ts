import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mission-control/attention
 * 
 * Fetches items that need user attention:
 * - Open escalations
 * - Content pending review
 * - Escalated engagement (comments needing response)
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

    // Fetch all attention items in parallel
    const [
      escalations,
      pendingContent,
      escalatedEngagements,
    ] = await Promise.all([
      // Get open escalations
      prisma.escalation.findMany({
        where: {
          organizationId: orgId,
          status: "OPEN",
        },
        orderBy: [
          { priority: "desc" },
          { createdAt: "asc" },
        ],
        take: 10,
      }),
      
      // Get content pending review
      prisma.content.findMany({
        where: {
          organizationId: orgId,
          status: "PENDING_REVIEW",
        },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: {
          socialAccount: true,
        },
      }),
      
      // Get escalated engagements
      prisma.engagement.findMany({
        where: {
          organizationId: orgId,
          isEscalated: true,
          aiResponseStatus: { in: ["PENDING", "PENDING_REVIEW"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Format escalations
    const escalationItems = escalations.map(e => ({
      id: e.id,
      type: "escalation" as const,
      title: formatEscalationTitle(e.reason),
      description: e.reason.substring(0, 100),
      priority: e.priority.toLowerCase(),
      actionLabel: "Review",
      actionUrl: `/mission-control/escalations?id=${e.id}`,
      createdAt: e.createdAt.toISOString(),
    }));

    // Format pending content
    const contentItems = pendingContent.map(c => ({
      id: c.id,
      type: "content_review" as const,
      title: `${c.contentType} ready for review`,
      description: c.caption?.substring(0, 80) || "No caption",
      priority: "medium" as const,
      actionLabel: "Preview & Approve",
      actionUrl: `/mission-control/review?id=${c.id}`,
      createdAt: c.createdAt.toISOString(),
    }));

    // Format escalated engagements
    const engagementItems = escalatedEngagements.map(e => ({
      id: e.id,
      type: "escalated_comment" as const,
      title: `${e.engagementType} needs attention`,
      description: e.body?.substring(0, 80) || "No message",
      priority: "high" as const,
      actionLabel: "See response & approve",
      actionUrl: `/mission-control/engagement?id=${e.id}`,
      createdAt: e.createdAt.toISOString(),
    }));

    // Combine and sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const allItems = [...escalationItems, ...contentItems, ...engagementItems]
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority as keyof typeof priorityOrder] - 
          priorityOrder[b.priority as keyof typeof priorityOrder];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return NextResponse.json({
      items: allItems,
      counts: {
        total: allItems.length,
        escalations: escalations.length,
        pendingContent: pendingContent.length,
        escalatedEngagements: escalatedEngagements.length,
      },
    });
  } catch (error) {
    console.error("Error fetching attention items:", error);
    return NextResponse.json(
      { error: "Failed to fetch attention items" },
      { status: 500 }
    );
  }
}

function formatEscalationTitle(reason: string): string {
  // Extract a short title from the reason
  const lowerReason = reason.toLowerCase();
  
  if (lowerReason.includes("confidence")) return "Low confidence score";
  if (lowerReason.includes("crisis")) return "Crisis detected";
  if (lowerReason.includes("complaint")) return "Customer complaint";
  if (lowerReason.includes("refund")) return "Refund request";
  if (lowerReason.includes("legal")) return "Legal issue";
  if (lowerReason.length > 40) return reason.substring(0, 40) + "...";
  return reason;
}
