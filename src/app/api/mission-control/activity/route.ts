import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AgentName } from "@prisma/client";

/**
 * GET /api/mission-control/activity
 * 
 * Fetches recent AI agent activity for the activity feed.
 * Uses ActivityLog table primarily, falls back to AgentLog.
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
    const agent = searchParams.get("agent");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    // Try to fetch from ActivityLog first
    type ActivityLogEntry = {
      id: string;
      createdAt: Date;
      agentName: string | null;
      action: string;
      description: string | null;
      type: string;
      platform?: string;
      status: string;
    };
    let activityLogs: ActivityLogEntry[] = [];

    const activityWhere: any = { organizationId: orgId };
    if (agent && agent !== "all") {
      activityWhere.agentName = agent.toUpperCase() as AgentName;
    }

    try {
      const logs = await prisma.activityLog.findMany({
        where: activityWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      activityLogs = logs.map(log => ({
        id: log.id,
        createdAt: log.createdAt,
        agentName: log.agentName,
        action: log.action,
        description: log.description || log.action,
        type: log.type,
        platform: (log.metadata as any)?.platform,
        status: "success" as const,
      }));
    } catch (error) {
      // ActivityLog table might not exist, fall back to AgentLog
      console.log("ActivityLog not available, using AgentLog");
    }

    // If no activity logs, use AgentLog
    if (activityLogs.length === 0) {
      const agentLogWhere: any = { organizationId: orgId };
      if (agent && agent !== "all") {
        agentLogWhere.agentName = agent.toUpperCase() as AgentName;
      }

      const agentLogs = await prisma.agentLog.findMany({
        where: agentLogWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      activityLogs = agentLogs.map(log => ({
        id: log.id,
        createdAt: log.createdAt,
        agentName: log.agentName,
        action: log.action,
        description: `${log.action} - ${log.status}`,
        type: "AGENT_ACTION",
        status: log.status === "SUCCESS" ? "success" : log.status === "FAILED" ? "failed" : "pending",
      }));
    }

    // Format timestamps
    const now = new Date();
    const formattedActivities = activityLogs.map(activity => {
      const diffMs = now.getTime() - new Date(activity.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timestamp: string;
      if (diffMins < 1) {
        timestamp = "Just now";
      } else if (diffMins < 60) {
        timestamp = `${diffMins} min ago`;
      } else if (diffHours < 24) {
        timestamp = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      } else if (diffDays === 1) {
        timestamp = "Yesterday";
      } else {
        timestamp = `${diffDays} days ago`;
      }

      return {
        id: activity.id,
        timestamp,
        agent: formatAgentName(activity.agentName),
        action: formatAction(activity.action),
        details: activity.description,
        platform: activity.platform,
        status: activity.status,
      };
    });

    // Get unique agents for filters
    const uniqueAgents = [...new Set(activityLogs.map(l => formatAgentName(l.agentName)))];

    return NextResponse.json({
      activities: formattedActivities,
      agents: ["all", ...uniqueAgents],
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    );
  }
}

function formatAgentName(agentName: string | null): string {
  const nameMap: Record<string, string> = {
    CONTENT_CREATOR: "ContentCreator",
    ENGAGEMENT: "Engagement",
    ANALYTICS: "Analytics",
    STRATEGY: "Strategy",
    TREND_SCOUT: "TrendScout",
    PUBLISHER: "Publisher",
    COMPETITOR_INTELLIGENCE: "CompetitorIntel",
    ORCHESTRATOR: "Orchestrator",
    ONBOARDING_INTELLIGENCE: "Onboarding",
  };
  return nameMap[agentName || ""] || agentName || "Unknown";
}

function formatAction(action: string | null): string {
  if (!action) return "Unknown";
  // Make action more readable
  return action
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^./, str => str.toUpperCase());
}
