/**
 * Billing - Entitlements & Feature Gating
 * 
 * Provides functions to check what features and agents
 * an organization has access to based on their subscription plan.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";

// ============================================================
// AGENT TIERS DEFINITION
// ============================================================

export const AGENT_TIERS: Record<string, string[]> = {
  // Core agents - essential for basic functionality
  core: [
    "CONTENT_CREATOR",
    "ENGAGEMENT",
    "PUBLISHER",
    "ANALYTICS",
    "STRATEGY",
    "TREND_SCOUT",
    "COMPLIANCE",
    "CONTENT_REPLENISHMENT",
    "CALENDAR_OPTIMIZER",
    "HASHTAG_OPTIMIZER",
  ],
  
  // Intelligence agents - advanced analytics and insights
  intelligence: [
    // All core agents plus:
    "COMPETITOR_INTELLIGENCE",
    "SOCIAL_LISTENING",
    "AUDIENCE_INTELLIGENCE",
    "INFLUENCER_SCOUT",
    "SOCIAL_SEO",
    "CAPTION_REWRITER",
    "BRAND_VOICE_GUARDIAN",
    "REPORTING_NARRATOR",
    "AB_TESTING",
  ],
  
  // Full agents - all capabilities including premium
  full: [
    // All intelligence agents plus:
    "CREATIVE_DIRECTOR",
    "PREDICTIVE_CONTENT",
    "ROI_ATTRIBUTION",
    "CROSS_CHANNEL_ATTRIBUTION",
    "AD_COPY",
    "SENTIMENT_INTELLIGENCE",
    "COMPETITIVE_AD_INTELLIGENCE",
    "PRICING_INTELLIGENCE",
    "COMMUNITY_BUILDER",
    "MEDIA_PITCH",
    "UGC_CURATOR",
    "REVIEW_RESPONSE",
    "REPURPOSE",
    "LOCALIZATION",
    "CHURN_PREDICTION",
    "ONBOARDING_INTELLIGENCE",
  ],
};

/**
 * Expand tiers cumulatively (intelligence includes core, full includes all)
 */
export function getAgentsForTier(tier: string): string[] {
  switch (tier) {
    case "core":
      return AGENT_TIERS.core;
    case "intelligence":
      return [...AGENT_TIERS.core, ...AGENT_TIERS.intelligence];
    case "full":
      return [...AGENT_TIERS.core, ...AGENT_TIERS.intelligence, ...AGENT_TIERS.full];
    case "custom":
      // Custom will be handled separately
      return [];
    default:
      return AGENT_TIERS.core;
  }
}

// ============================================================
// TYPES
// ============================================================

export interface Entitlements {
  isActive: boolean;
  plan: {
    id: string;
    name: string;
    slug: string;
    agentTier: string;
    maxPlatforms: number;
    maxPostsPerMonth: number;
    maxBrands: number;
    maxTeamMembers: number;
    isUsageBased: boolean;
    usageUnitName: string | null;
    usageIncluded: number | null;
  } | null;
  enabledAgents: string[];
  features: Record<string, boolean>;
  canPublish: boolean;
  currentUsage?: number;
  usageLimit?: number | null;
  reason?: string;
  status?: string;
}

// ============================================================
// GET ENTITLEMENTS (Cached)
// ============================================================

/**
 * Get entitlements for an organization - cached per request
 */
export const getEntitlements = cache(async (organizationId: string): Promise<Entitlements> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { billingPlan: true },
  });

  // No subscription or not active
  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return {
      isActive: false,
      plan: null,
      enabledAgents: [],
      features: {},
      canPublish: false,
      reason: subscription?.status === "past_due" ? "payment_past_due" : "no_subscription",
      status: subscription?.status ?? "none",
    };
  }

  const plan = subscription.billingPlan;
  
  // Get enabled agents based on tier or custom list
  let enabledAgents: string[];
  if (plan.agentTier === "custom") {
    enabledAgents = plan.enabledAgents;
  } else {
    enabledAgents = getAgentsForTier(plan.agentTier);
  }

  return {
    isActive: true,
    plan: {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      agentTier: plan.agentTier,
      maxPlatforms: plan.maxPlatforms,
      maxPostsPerMonth: plan.maxPostsPerMonth,
      maxBrands: plan.maxBrands,
      maxTeamMembers: plan.maxTeamMembers,
      isUsageBased: plan.isUsageBased,
      usageUnitName: plan.usageUnitName,
      usageIncluded: plan.usageIncluded,
    },
    enabledAgents,
    features: plan.features as Record<string, boolean>,
    canPublish: true,
    currentUsage: subscription.currentUsage,
    usageLimit: plan.usageIncluded,
    status: subscription.status,
  };
});

// ============================================================
// CHECK AGENT ACCESS
// ============================================================

/**
 * Check if an organization can run a specific agent
 * Used by Orchestrator before dispatching any agent
 */
export async function canRunAgent(organizationId: string, agentName: string): Promise<boolean> {
  const entitlements = await getEntitlements(organizationId);
  
  if (!entitlements.isActive) {
    return false;
  }
  
  return entitlements.enabledAgents.includes(agentName);
}

/**
 * Check if an organization can run multiple agents
 */
export async function canRunAgents(organizationId: string, agentNames: string[]): Promise<{
  allowed: string[];
  denied: string[];
}> {
  const entitlements = await getEntitlements(organizationId);
  
  const allowed: string[] = [];
  const denied: string[] = [];
  
  for (const agent of agentNames) {
    if (entitlements.isActive && entitlements.enabledAgents.includes(agent)) {
      allowed.push(agent);
    } else {
      denied.push(agent);
    }
  }
  
  return { allowed, denied };
}

// ============================================================
// CHECK PUBLISHING
// ============================================================

/**
 * Get start of current billing month
 */
function getStartOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Check if an organization can publish (has available posts)
 */
export async function canPublish(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  postsUsed?: number;
  postsLimit?: number;
}> {
  const entitlements = await getEntitlements(organizationId);

  if (!entitlements.isActive) {
    return { 
      allowed: false, 
      reason: entitlements.reason ?? "no_subscription" 
    };
  }

  // Check post limit (if not unlimited)
  if (entitlements.plan && entitlements.plan.maxPostsPerMonth !== -1) {
    const postsThisMonth = await prisma.content.count({
      where: {
        organizationId,
        publishedAt: { gte: getStartOfMonth() },
      },
    });

    if (postsThisMonth >= entitlements.plan.maxPostsPerMonth) {
      return {
        allowed: false,
        reason: "monthly_post_limit_reached",
        postsUsed: postsThisMonth,
        postsLimit: entitlements.plan.maxPostsPerMonth,
      };
    }

    return {
      allowed: true,
      postsUsed: postsThisMonth,
      postsLimit: entitlements.plan.maxPostsPerMonth,
    };
  }

  return { allowed: true };
}

// ============================================================
// CHECK PLATFORM LIMIT
// ============================================================

/**
 * Check if organization can add another platform
 */
export async function canAddPlatform(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  platformsUsed?: number;
  platformsLimit?: number;
}> {
  const entitlements = await getEntitlements(organizationId);

  if (!entitlements.isActive) {
    return { allowed: false, reason: "no_subscription" };
  }

  const currentPlatforms = await prisma.socialAccount.count({
    where: { organizationId, isActive: true },
  });

  const limit = entitlements.plan?.maxPlatforms ?? 0;
  
  // -1 means unlimited
  if (limit === -1 || currentPlatforms < limit) {
    return {
      allowed: true,
      platformsUsed: currentPlatforms,
      platformsLimit: limit,
    };
  }

  return {
    allowed: false,
    reason: "platform_limit_reached",
    platformsUsed: currentPlatforms,
    platformsLimit: limit,
  };
}

// ============================================================
// CHECK TEAM MEMBERS
// ============================================================

/**
 * Check if organization can add another team member
 */
export async function canAddTeamMember(organizationId: string): Promise<{
  allowed: boolean;
  reason?: string;
  membersUsed?: number;
  membersLimit?: number;
}> {
  const entitlements = await getEntitlements(organizationId);

  if (!entitlements.isActive) {
    return { allowed: false, reason: "no_subscription" };
  }

  const currentMembers = await prisma.orgMember.count({
    where: { organizationId },
  });

  const limit = entitlements.plan?.maxTeamMembers ?? 0;
  
  // -1 means unlimited
  if (limit === -1 || currentMembers < limit) {
    return {
      allowed: true,
      membersUsed: currentMembers,
      membersLimit: limit,
    };
  }

  return {
    allowed: false,
    reason: "team_member_limit_reached",
    membersUsed: currentMembers,
    membersLimit: limit,
  };
}

// ============================================================
// CHECK USAGE (For Usage-Based Plans)
// ============================================================

/**
 * Check usage for usage-based plans (Agency)
 */
export async function getUsageStatus(organizationId: string): Promise<{
  current: number;
  included: number | null;
  percentUsed: number;
  isOverLimit: boolean;
  unitName: string | null;
} | null> {
  const entitlements = await getEntitlements(organizationId);
  
  if (!entitlements.plan?.isUsageBased || !entitlements.usageLimit) {
    return null;
  }

  const current = entitlements.currentUsage ?? 0;
  const included = entitlements.usageLimit;
  const percentUsed = (current / included) * 100;

  return {
    current,
    included,
    percentUsed,
    isOverLimit: current > included,
    unitName: entitlements.plan.usageUnitName,
  };
}

// ============================================================
// GET AVAILABLE PLANS (for pricing UI)
// ============================================================

/**
 * Get all public plans with their prices
 */
export async function getAvailablePlans(currency: string = "usd") {
  const plans = await prisma.billingPlan.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    include: {
      stripePrices: {
        where: {
          currency,
          isActive: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return plans.map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    agentTier: plan.agentTier,
    maxPlatforms: plan.maxPlatforms,
    maxPostsPerMonth: plan.maxPostsPerMonth,
    maxBrands: plan.maxBrands,
    maxTeamMembers: plan.maxTeamMembers,
    trialDays: plan.trialDays,
    isUsageBased: plan.isUsageBased,
    usageUnitName: plan.usageUnitName,
    usageIncluded: plan.usageIncluded,
    prices: plan.stripePrices.map((price: any) => ({
      interval: price.interval,
      amount: price.unitAmount,
      priceId: price.stripePriceId,
    })),
  }));
}

// ============================================================
// CHECK SUBSCRIPTION STATUS
// ============================================================

/**
 * Quick check if subscription is active/trialing
 */
export async function hasActiveSubscription(organizationId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { status: true },
  });

  return subscription?.status === "active" || subscription?.status === "trialing";
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(organizationId: string): Promise<string | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { status: true },
  });

  return subscription?.status ?? null;
}
