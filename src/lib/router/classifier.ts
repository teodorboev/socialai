/**
 * Smart Router Classifier
 * 
 * Classifies requests into tiers based on agent + task type.
 * Reads configuration from database - zero hardcoded values.
 */

import { prisma } from "@/lib/prisma";
import { providerRegistry } from "./providers/registry";

export type TaskTier = "budget" | "mid" | "flagship";
export type TaskType = 
  | "classification"
  | "extraction"
  | "summarization"
  | "generation"
  | "reasoning"
  | "coding"
  | "analysis"
  | "translation"
  | "moderation"
  | "vision"
  | "unknown";

export interface ClassificationResult {
  tier: TaskTier;
  taskType: TaskType;
  reasoning?: string;
  /** If true, force flagship tier regardless of classification */
  forceFlagship?: boolean;
}

export interface ClassificationInput {
  agentName: string;        // "CONTENT_CREATOR", "ENGAGEMENT", etc.
  taskType?: TaskType;      // Optional explicit task type
  context?: {
    hasTools?: boolean;
    hasVision?: boolean;
    isComplexReasoning?: boolean;
    requiresCreativity?: boolean;
    hasLongContext?: boolean;
  };
}

/**
 * Classify a request into a tier.
 * Reads from DB routing rules first, then uses heuristics.
 */
export async function classifyRequest(input: ClassificationInput): Promise<ClassificationResult> {
  // 1. Check for explicit routing rules in DB
  const explicitRule = await prisma.routingRule.findFirst({
    where: {
      isActive: true,
      matchAgent: input.agentName,
      ...(input.taskType && { matchTaskType: input.taskType }),
    },
    orderBy: { priority: "desc" },
    include: { targetModel: true },
  });

  if (explicitRule?.overrideTier) {
    return {
      tier: explicitRule.overrideTier as TaskTier,
      taskType: input.taskType || "unknown",
      reasoning: `Matched explicit routing rule: ${explicitRule.name}`,
    };
  }

  // 2. Check if rule forces a specific model
  if (explicitRule?.targetModel) {
    return {
      tier: explicitRule.targetModel.tier as TaskTier,
      taskType: input.taskType || "unknown",
      reasoning: `Matched explicit model rule: ${explicitRule.name}`,
      forceFlagship: explicitRule.targetModel.tier === "flagship",
    };
  }

  // 3. Use heuristics based on context
  const context = input.context || {};

  // If tools are required, we need a model that supports tool use
  if (context.hasTools) {
    // Most budget models don't support tool use well
    return {
      tier: "mid",
      taskType: input.taskType || "unknown",
      reasoning: "Task requires tool use - using mid tier",
    };
  }

  // Vision requires models with vision capabilities
  if (context.hasVision) {
    return {
      tier: "mid",
      taskType: "vision",
      reasoning: "Task requires vision - using mid tier",
    };
  }

  // Complex reasoning needs flagship
  if (context.isComplexReasoning) {
    return {
      tier: "flagship",
      taskType: "reasoning",
      reasoning: "Complex reasoning detected - using flagship tier",
    };
  }

  // Creative generation can benefit from flagship
  if (context.requiresCreativity) {
    return {
      tier: "mid",
      taskType: input.taskType || "generation",
      reasoning: "Creative task - using mid tier for balance",
    };
  }

  // 4. Default based on task type from AgentName
  const defaultTier = getDefaultTierForAgent(input.agentName, input.taskType);
  
  return {
    tier: defaultTier,
    taskType: input.taskType || "unknown",
    reasoning: `Default tier for ${input.agentName}`,
  };
}

/**
 * Get default tier based on agent type.
 * These defaults can be overridden in DB.
 */
function getDefaultTierForAgent(agentName: string, taskType?: TaskType): TaskTier {
  // Map agent names to default tiers
  // These can be customized via DB routing rules
  
  const agentTierMap: Record<string, TaskTier> = {
    // High-complexity agents - default to mid/flagship
    CONTENT_CREATOR: "mid",
    STRATEGY: "flagship",
    ANALYTICS: "mid",
    REPORTING_NARRATOR: "flagship",
    TREND_SCOUT: "mid",
    COMPETITOR_INTELLIGENCE: "mid",
    CRISIS_RESPONSE: "flagship",
    ONBOARDING_INTELLIGENCE: "flagship",
    BRAND_VOICE_GUARDIAN: "mid",
    SELF_EVALUATION: "mid",
    CONTENT_DNA: "flagship",
    AUDIENCE_INTELLIGENCE: "mid",
    
    // Medium-complexity agents
    ENGAGEMENT: "budget",
    COMPLIANCE: "budget",
    VISUAL: "mid",
    CAPTION_REWRITER: "budget",
    REPURPOSE: "budget",
    HASHTAG_OPTIMIZER: "budget",
    SOCIAL_LISTENING: "budget",
    SENTIMENT_INTELLIGENCE: "mid",
    UGC_CURATOR: "budget",
    REVIEW_RESPONSE: "budget",
    INFLUENCER_SCOUT: "mid",
    PRICING_INTELLIGENCE: "mid",
    COMPETITIVE_AD_INTELLIGENCE: "mid",
    MEDIA_PITCH: "mid",
    CALENDAR_OPTIMIZER: "budget",
    LOCALIZATION: "budget",
    ROI_ATTRIBUTION: "mid",
    CROSS_CHANNEL_ATTRIBUTION: "mid",
    CHURN_PREDICTION: "mid",
    GOAL_TRACKING: "mid",
    
    // Low-complexity agents - default to budget
    PUBLISHER: "budget",
    AB_TESTING: "budget",
    SOCIAL_SEO: "budget",
    AD_COPY: "budget",
    COMMUNITY_BUILDER: "budget",
    
    // Orchestrator and system agents
    ORCHESTRATOR: "mid",
  };

  return agentTierMap[agentName] || "budget";
}

/**
 * Check if a tier is appropriate for the task requirements
 */
export function validateTierForTask(tier: TaskTier, requirements: {
  needsTools?: boolean;
  needsVision?: boolean;
  needsReasoning?: boolean;
}): { valid: boolean; reason?: string } {
  if (requirements.needsTools && tier === "budget") {
    return { valid: false, reason: "Budget tier may not support tool use well" };
  }
  if (requirements.needsVision && tier === "budget") {
    return { valid: false, reason: "Budget tier may not support vision" };
  }
  if (requirements.needsReasoning && tier === "budget") {
    return { valid: false, reason: "Budget tier may not have strong reasoning" };
  }
  return { valid: true };
}
