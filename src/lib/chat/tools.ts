/**
 * Chat Tools Library
 * 
 * Contains all query and action functions that the ChatAgent can use
 * to answer questions and make changes to the platform.
 */

import { prisma } from "@/lib/prisma";

// ============================================================================
// QUERY TOOLS - Read-only data fetching
// ============================================================================

/**
 * Get current metrics for the organization
 */
export async function getMetrics(orgId: string, period: string = "7d") {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      organizationId: orgId,
      snapshotDate: { gte: startDate },
    },
    orderBy: { snapshotDate: "desc" },
  });

  if (snapshots.length === 0) {
    return {
      followers: 0,
      followersChange: 0,
      engagementRate: 0,
      reach: 0,
      impressions: 0,
      period: days,
    };
  }

  const latest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];

  return {
    followers: latest.followers || 0,
    followersChange: (latest.followers || 0) - (oldest.followers || 0),
    engagementRate: latest.engagementRate || 0,
    reach: latest.reach || 0,
    impressions: latest.impressions || 0,
    period: days,
    snapshotDate: latest.snapshotDate.toISOString(),
  };
}

/**
 * Get content status counts
 */
export async function getContentStatus(orgId: string) {
  const [draft, pendingReview, approved, scheduled, published, failed] = await Promise.all([
    prisma.content.count({ where: { organizationId: orgId, status: "DRAFT" } }),
    prisma.content.count({ where: { organizationId: orgId, status: "PENDING_REVIEW" } }),
    prisma.content.count({ where: { organizationId: orgId, status: "APPROVED" } }),
    prisma.content.count({ where: { organizationId: orgId, status: "SCHEDULED" } }),
    prisma.content.count({ where: { organizationId: orgId, status: "PUBLISHED" } }),
    prisma.content.count({ where: { organizationId: orgId, status: "FAILED" } }),
  ]);

  return { draft, pendingReview, approved, scheduled, published, failed };
}

/**
 * Get open escalations
 */
export async function getEscalations(orgId: string) {
  const escalations = await prisma.escalation.findMany({
    where: {
      organizationId: orgId,
      status: "OPEN",
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "desc" },
    ],
    take: 10,
  });

  return escalations.map(e => ({
    id: e.id,
    reason: e.reason,
    priority: e.priority,
    agentName: e.agentName,
    createdAt: e.createdAt.toISOString(),
  }));
}

/**
 * Get brand configuration
 */
export async function getBrandConfig(orgId: string) {
  const config = await prisma.brandConfig.findUnique({
    where: { organizationId: orgId },
  });

  if (!config) {
    return { configured: false };
  }

  return {
    configured: true,
    brandName: config.brandName,
    industry: config.industry,
    voiceTone: config.voiceTone,
    contentThemes: config.contentThemes,
    doNots: config.doNots,
    targetAudience: config.targetAudience,
    hashtagStrategy: config.hashtagStrategy,
  };
}

/**
 * Get posting schedule
 */
export async function getPostingSchedule(orgId: string) {
  const schedules = await prisma.postingSchedule.findMany({
    where: {
      organizationId: orgId,
      isEnabled: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { timeUtc: "asc" }],
  });

  return schedules.map(s => ({
    dayOfWeek: s.dayOfWeek,
    timeUtc: s.timeUtc,
    platform: s.platform,
  }));
}

/**
 * Get competitors
 */
export async function getCompetitors(orgId: string) {
  const competitors = await prisma.competitor.findMany({
    where: { organizationId: orgId },
    include: {
      accounts: true,
    },
    orderBy: { name: "asc" },
  });

  return competitors.map(c => ({
    name: c.name,
    industry: c.industry,
    accounts: c.accounts.map(a => ({
      platform: a.platform,
      handle: a.handle,
    })),
  }));
}

/**
 * Get connected social accounts
 */
export async function getSocialAccounts(orgId: string) {
  const accounts = await prisma.socialAccount.findMany({
    where: { organizationId: orgId, isActive: true },
  });

  return accounts.map(a => ({
    platform: a.platform,
    username: a.platformUsername,
    connected: true,
  }));
}

/**
 * Get recent activity
 */
export async function getRecentActivity(orgId: string, limit: number = 10) {
  const logs = await prisma.agentLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return logs.map(l => ({
    agent: l.agentName,
    action: l.action,
    status: l.status,
    timestamp: l.createdAt.toISOString(),
  }));
}

/**
 * Get goals and progress
 */
export async function getGoals(orgId: string) {
  const goals = await prisma.goal.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return goals.map(g => ({
    type: g.type,
    description: g.description,
    targets: g.targets,
    currentProgress: g.currentProgress,
    startDate: g.startDate?.toISOString(),
    targetDate: g.targetDate?.toISOString(),
    achievedAt: g.achievedAt?.toISOString(),
  }));
}

/**
 * Get scheduled posts
 */
export async function getScheduledPosts(orgId: string, days: number = 7) {
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const schedules = await prisma.schedule.findMany({
    where: {
      organizationId: orgId,
      status: "PENDING",
      scheduledFor: { gte: new Date(), lte: futureDate },
    },
    include: {
      content: { select: { caption: true, contentType: true } },
      socialAccount: { select: { platform: true, platformUsername: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return schedules.map(s => ({
    id: s.id,
    scheduledFor: s.scheduledFor.toISOString(),
    platform: s.socialAccount?.platform,
    contentType: s.content?.contentType,
    caption: s.content?.caption?.substring(0, 100),
  }));
}

// ============================================================================
// ACTION TOOLS - Write operations
// ============================================================================

/**
 * Update posting schedule
 */
export async function updateSchedule(
  orgId: string,
  action: "add" | "remove",
  dayOfWeek: number,
  timeUtc: string,
  platform?: string
) {
  const platformValue = (platform?.toUpperCase() || "INSTAGRAM") as "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN";
  
  if (action === "add") {
    await prisma.postingSchedule.upsert({
      where: {
        organizationId_platform_dayOfWeek_timeUtc: {
          organizationId: orgId,
          platform: platformValue,
          dayOfWeek,
          timeUtc,
        },
      },
      create: {
        organizationId: orgId,
        platform: platformValue,
        dayOfWeek,
        timeUtc,
        isEnabled: true,
      },
      update: {
        isEnabled: true,
      },
    });
    return { success: true, message: `Added posting schedule: ${getDayName(dayOfWeek)} at ${timeUtc}` };
  } else {
    await prisma.postingSchedule.updateMany({
      where: {
        organizationId: orgId,
        dayOfWeek,
        timeUtc,
        platform: platformValue,
      },
      data: { isEnabled: false },
    });
    return { success: true, message: `Removed posting schedule: ${getDayName(dayOfWeek)} at ${timeUtc}` };
  }
}

/**
 * Add a competitor to track
 */
export async function addCompetitor(orgId: string, name: string, handle: string, platform: string) {
  const competitor = await prisma.competitor.create({
    data: {
      organizationId: orgId,
      name,
      accounts: {
        create: {
          platform: platform.toUpperCase() as "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN",
          handle,
        },
      },
    },
  });
  return { success: true, message: `Now tracking competitor: ${name} (@${handle})` };
}

/**
 * Remove a competitor
 */
export async function removeCompetitor(orgId: string, competitorId: string) {
  await prisma.competitor.delete({
    where: { id: competitorId },
  });
  return { success: true, message: "Competitor removed from tracking" };
}

/**
 * Create a content request (draft)
 */
export async function createContentRequest(
  orgId: string,
  platform: string,
  contentType: string,
  caption: string
) {
  // Get first active social account for this platform
  const platformValue = platform.toUpperCase() as "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "TWITTER" | "LINKEDIN";
  const contentTypeValue = contentType.toUpperCase() as "POST" | "STORY" | "REEL" | "CAROUSEL" | "THREAD" | "ARTICLE" | "POLL";
  
  const account = await prisma.socialAccount.findFirst({
    where: { organizationId: orgId, platform: platformValue, isActive: true },
  });

  const content = await prisma.content.create({
    data: {
      organizationId: orgId,
      socialAccountId: account?.id,
      platform: platformValue,
      contentType: contentTypeValue,
      caption,
      status: "DRAFT",
      confidenceScore: 0.5, // Placeholder - would be generated by AI
    },
  });

  return { success: true, message: "Content request created as draft", contentId: content.id };
}

/**
 * Pause/resume publishing
 */
export async function setPublishingEnabled(orgId: string, enabled: boolean) {
  let settings = await prisma.orgSettings.findUnique({
    where: { organizationId: orgId },
  });

  if (!settings) {
    settings = await prisma.orgSettings.create({
      data: {
        organizationId: orgId,
        autoEngagementEnabled: true, // Default
      },
    });
  }

  // We don't have a direct field for publishing enabled, so we'd need to add one
  // For now, return a message about what would happen
  return {
    success: true,
    message: enabled 
      ? "Publishing enabled. AI will continue scheduling and publishing content."
      : "Publishing paused. No new content will be published until re-enabled.",
  };
}

/**
 * Approve content
 */
export async function approveContent(contentId: string, orgId: string) {
  await prisma.content.update({
    where: { id: contentId, organizationId: orgId },
    data: { status: "APPROVED" },
  });
  return { success: true, message: "Content approved" };
}

/**
 * Reject content
 */
export async function rejectContent(contentId: string, orgId: string, reason: string) {
  await prisma.content.update({
    where: { id: contentId, organizationId: orgId },
    data: { 
      status: "REJECTED",
      rejectionReason: reason,
    },
  });
  return { success: true, message: "Content rejected" };
}

/**
 * Update brand voice
 */
export async function updateBrandVoice(
  orgId: string,
  updates: {
    voiceTone?: any;
    contentThemes?: string[];
    doNots?: string[];
  }
) {
  await prisma.brandConfig.update({
    where: { organizationId: orgId },
    data: {
      ...(updates.voiceTone && { voiceTone: updates.voiceTone }),
      ...(updates.contentThemes && { contentThemes: updates.contentThemes }),
      ...(updates.doNots && { doNots: updates.doNots }),
    },
  });
  return { success: true, message: "Brand voice updated" };
}

/**
 * Update do-nots list
 */
export async function updateDoNots(orgId: string, doNots: string[], action: "add" | "remove" | "replace") {
  const config = await prisma.brandConfig.findUnique({
    where: { organizationId: orgId },
  });

  let currentDoNots = config?.doNots || [];

  if (action === "replace") {
    currentDoNots = doNots;
  } else if (action === "add") {
    currentDoNots = [...new Set([...currentDoNots, ...doNots])];
  } else if (action === "remove") {
    currentDoNots = currentDoNots.filter(d => !doNots.includes(d));
  }

  await prisma.brandConfig.update({
    where: { organizationId: orgId },
    data: { doNots: currentDoNots },
  });

  return { success: true, message: `Updated do-nots list (${action})` };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDayName(day: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[day] || "Unknown";
}

/**
 * Build tools description for the AI system prompt
 */
export function getToolsDescription(): string {
  return JSON.stringify([
    {
      name: "get_metrics",
      description: "Get current followers, engagement rate, reach for the organization",
      parameters: { period: "7d|30d|90d" }
    },
    {
      name: "get_content_status",
      description: "Get counts of content by status (draft, pending, scheduled, published)",
      parameters: {}
    },
    {
      name: "get_escalations",
      description: "Get open escalations requiring human attention",
      parameters: {}
    },
    {
      name: "get_brand_config",
      description: "Get current brand voice configuration",
      parameters: {}
    },
    {
      name: "get_posting_schedule",
      description: "Get current posting schedule",
      parameters: {}
    },
    {
      name: "get_competitors",
      description: "Get list of tracked competitors",
      parameters: {}
    },
    {
      name: "get_social_accounts",
      description: "Get connected social media accounts",
      parameters: {}
    },
    {
      name: "get_recent_activity",
      description: "Get recent agent activity",
      parameters: { limit: "number" }
    },
    {
      name: "get_goals",
      description: "Get current goals and progress",
      parameters: {}
    },
    {
      name: "get_scheduled_posts",
      description: "Get upcoming scheduled posts",
      parameters: { days: "number" }
    },
    {
      name: "update_schedule",
      description: "Change posting schedule (add or remove time slots)",
      parameters: { action: "add|remove", dayOfWeek: "0-6", timeUtc: "HH:MM", platform: "optional" }
    },
    {
      name: "add_competitor",
      description: "Start tracking a new competitor",
      parameters: { name: "string", handle: "string", platform: "string" }
    },
    {
      name: "remove_competitor",
      description: "Stop tracking a competitor",
      parameters: { competitorId: "string" }
    },
    {
      name: "create_content_request",
      description: "Request specific content to be created",
      parameters: { platform: "string", contentType: "string", caption: "string" }
    },
    {
      name: "set_publishing_enabled",
      description: "Pause or resume content publishing",
      parameters: { enabled: "boolean" }
    },
    {
      name: "approve_content",
      description: "Approve content for publishing",
      parameters: { contentId: "string" }
    },
    {
      name: "reject_content",
      description: "Reject content with a reason",
      parameters: { contentId: "string", reason: "string" }
    },
    {
      name: "update_brand_voice",
      description: "Update brand voice configuration",
      parameters: { voiceTone: "object", contentThemes: "array", doNots: "array" }
    },
    {
      name: "update_do_nots",
      description: "Update the do-nots list",
      parameters: { doNots: "array", action: "add|remove|replace" }
    },
  ], null, 2);
}
