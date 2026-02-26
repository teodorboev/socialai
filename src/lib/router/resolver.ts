/**
 * Smart Router Resolver
 * 
 * Resolves the best model for a given tier and gets fallback models.
 * All model data comes from database - zero hardcoded model IDs.
 */

import { prisma } from "@/lib/prisma";
import { providerRegistry } from "./providers/registry";
import type { TaskTier, TaskType } from "./classifier";
import type { LLMModel, LLMProvider } from "@prisma/client";

export interface ResolvedModel {
  model: LLMModel;
  provider: LLMProvider;
  fallbacks: Array<{ model: LLMModel; provider: LLMProvider; reason: string }>;
}

export interface ResolverOptions {
  /** Prefer models with lower latency */
  preferLatency?: boolean;
  /** Prefer models with higher reliability */
  preferReliability?: boolean;
  /** Require specific capabilities (e.g., "vision", "tool_use") */
  requiredCapabilities?: string[];
  /** Maximum input tokens needed */
  maxInputTokens?: number;
  /** Maximum output tokens needed */
  maxOutputTokens?: number;
}

/**
 * Resolve the best model for a given tier and task.
 */
export async function resolveModel(
  tier: TaskTier,
  taskType: TaskType,
  options: ResolverOptions = {}
): Promise<ResolvedModel> {
  // Get active models for the tier, sorted by priority
  const models = await prisma.lLMModel.findMany({
    where: {
      tier,
      isActive: true,
      provider: {
        isActive: true,
      },
    },
    include: {
      provider: true,
    },
    orderBy: [
      { priorityInTier: "asc" },
      { sortOrder: "asc" },
    ],
  });

  // Filter by available providers
  const availableModels = models.filter((m) =>
    providerRegistry.isProviderAvailable(m.provider.name)
  );

  if (availableModels.length === 0) {
    throw new Error(`No available models for tier: ${tier}`);
  }

  // Apply filters based on options
  let filteredModels = availableModels;

  // Filter by required capabilities
  if (options.requiredCapabilities && options.requiredCapabilities.length > 0) {
    filteredModels = filteredModels.filter((m) =>
      options.requiredCapabilities!.every((cap) => m.capabilities.includes(cap))
    );

    if (filteredModels.length === 0) {
      // No model with all capabilities - relax and try again
      filteredModels = availableModels;
    }
  }

  // Filter by max input tokens
  if (options.maxInputTokens) {
    filteredModels = filteredModels.filter((m) => m.maxInputTokens >= options.maxInputTokens!);

    if (filteredModels.length === 0) {
      // No model with enough context - relax
      filteredModels = availableModels;
    }
  }

  // Filter by max output tokens
  if (options.maxOutputTokens) {
    filteredModels = filteredModels.filter((m) => m.maxOutputTokens >= options.maxOutputTokens!);

    if (filteredModels.length === 0) {
      // No model with enough output - relax
      filteredModels = availableModels;
    }
  }

  // Sort by preference
  if (options.preferLatency) {
    filteredModels.sort((a, b) => (a.avgLatencyMs || 1000) - (b.avgLatencyMs || 1000));
  } else if (options.preferReliability) {
    filteredModels.sort((a, b) => (b.reliability || 0.9) - (a.reliability || 0.9));
  }

  // Select the best model
  const bestModel = filteredModels[0];

  // Generate fallbacks
  const fallbacks = await getFallbacks(tier, bestModel.id, options);

  return {
    model: bestModel,
    provider: bestModel.provider,
    fallbacks,
  };
}

/**
 * Get fallback models if the primary model fails.
 */
export async function getFallbacks(
  tier: TaskTier,
  excludeModelId: string,
  options: ResolverOptions = {}
): Promise<Array<{ model: LLMModel; provider: LLMProvider; reason: string }>> {
  const fallbacks: Array<{ model: LLMModel; provider: LLMProvider; reason: string }> = [];

  // First, try other models in the same tier
  const sameTierModels = await prisma.lLMModel.findMany({
    where: {
      tier,
      isActive: true,
      id: { not: excludeModelId },
      provider: {
        isActive: true,
      },
    },
    include: {
      provider: true,
    },
    orderBy: { priorityInTier: "asc" },
  });

  for (const model of sameTierModels) {
    if (providerRegistry.isProviderAvailable(model.provider.name)) {
      fallbacks.push({
        model,
        provider: model.provider,
        reason: `Same tier fallback: ${model.displayName}`,
      });
    }
  }

  // If we don't have enough fallbacks, try higher tiers
  if (fallbacks.length < 2) {
    const higherTiers: TaskTier[] = tier === "budget" ? ["mid", "flagship"] : tier === "mid" ? ["flagship"] : [];
    
    for (const higherTier of higherTiers) {
      const higherModels = await prisma.lLMModel.findMany({
        where: {
          tier: higherTier,
          isActive: true,
          provider: {
            isActive: true,
          },
        },
        include: {
          provider: true,
        },
        orderBy: { priorityInTier: "asc" },
        take: 2,
      });

      for (const model of higherModels) {
        if (providerRegistry.isProviderAvailable(model.provider.name)) {
          // Check if we already have this in fallbacks
          if (!fallbacks.find((f) => f.model.id === model.id)) {
            fallbacks.push({
              model,
              provider: model.provider,
              reason: `Escalation fallback: ${model.displayName} (${higherTier} tier)`,
            });
          }
        }
      }
    }
  }

  return fallbacks.slice(0, 3); // Max 3 fallbacks
}

/**
 * Get all available models (for admin UI)
 */
export async function getAllModels() {
  return prisma.lLMModel.findMany({
    include: {
      provider: true,
    },
    orderBy: [
      { tier: "asc" },
      { priorityInTier: "asc" },
    ],
  });
}

/**
 * Get all providers with model counts
 */
export async function getAllProviders() {
  return prisma.lLMProvider.findMany({
    include: {
      models: {
        where: { isActive: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Update model performance metrics (called after each call)
 */
export async function updateModelMetrics(
  modelId: string,
  latencyMs: number,
  success: boolean
) {
  const model = await prisma.lLMModel.findUnique({ where: { id: modelId } });
  if (!model) return;

  // Update average latency (exponential moving average)
  const currentLatency = model.avgLatencyMs || latencyMs;
  const newLatency = Math.round(currentLatency * 0.9 + latencyMs * 0.1);

  // Update reliability
  const currentReliability = model.reliability || 0.9;
  const newReliability = success
    ? Math.min(1, currentReliability + 0.001)
    : Math.max(0, currentReliability - 0.01);

  await prisma.lLMModel.update({
    where: { id: modelId },
    data: {
      avgLatencyMs: newLatency,
      reliability: newReliability,
    },
  });
}
