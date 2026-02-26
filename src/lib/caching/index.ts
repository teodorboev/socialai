/**
 * LLM Caching - Unified Exports & Cost Tracking
 * 
 * Layer 1: Engagement scan deduplication (Redis-based)
 * Layer 2: Anthropic prompt caching
 * Layer 3: Template short-circuit
 * 
 * Cost tracking functions for Admin dashboard.
 */

import { prisma } from "@/lib/prisma";

// Re-export all caching functions
export { checkEngagementChanged, invalidateEngagementCache, getEngagementCacheStats } from "./engagement-dedup";
export { buildCachedSystemPrompt, extractCacheStats, calculateCostBreakdown } from "./prompt-cache";
export { tryTemplateResponse, seedDefaultTemplates } from "./template-responder";

// ============================================================
// COST TRACKING
// ============================================================

export type CacheLayer = "engagement_dedup" | "prompt_cache" | "template_short_circuit";

/**
 * Log a cache hit event (no LLM call was made).
 * Used for Layer 1 (engagement dedup) and Layer 3 (template short-circuit).
 */
export async function logCacheHit(
  organizationId: string,
  cacheLayer: CacheLayer,
  meta?: {
    agentName?: string;
    platform?: string;
  }
): Promise<void> {
  try {
    await prisma.agentCostEvent.create({
      data: {
        organizationId,
        agentName: meta?.agentName ?? "unknown",
        platform: meta?.platform,
        costCents: 0,
        cacheLayer,
        cacheHit: true,
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      },
    });
  } catch (error) {
    // Don't fail the main flow if cost logging fails
    console.error("Failed to log cache hit:", error);
  }
}

/**
 * Log an LLM call with full usage data.
 * Used for all Claude API calls with cost breakdown.
 */
export async function logLLMCall(params: {
  organizationId: string;
  agentName: string;
  tokensInput: number;
  tokensOutput: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  model: string;
  platform?: string;
  cacheSavingsUsd?: number;
  contentId?: string;
  pipelineRunId?: string;
}): Promise<void> {
  try {
    // Pricing as of Claude Sonnet 4
    const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
      "claude-sonnet-4-20250514": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
      "claude-sonnet-4-20250625": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
      "claude-haiku-4-5-20251001": { input: 0.80, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
    };

    const p = PRICING[params.model] ?? PRICING["claude-sonnet-4-20250514"];

    const inputCost = (params.tokensInput / 1_000_000) * p.input;
    const outputCost = (params.tokensOutput / 1_000_000) * p.output;
    const cacheReadCost = ((params.cacheReadTokens ?? 0) / 1_000_000) * p.cacheRead;
    const cacheWriteCost = ((params.cacheWriteTokens ?? 0) / 1_000_000) * p.cacheWrite;

    const estimatedCostUsd = inputCost + outputCost + cacheReadCost + cacheWriteCost;

    await prisma.agentCostEvent.create({
      data: {
        organizationId: params.organizationId,
        agentName: params.agentName,
        model: params.model,
        inputTokens: params.tokensInput,
        outputTokens: params.tokensOutput,
        totalTokens: params.tokensInput + params.tokensOutput,
        cacheReadTokens: params.cacheReadTokens ?? 0,
        cacheWriteTokens: params.cacheWriteTokens ?? 0,
        costCents: estimatedCostUsd * 100,
        platform: params.platform,
        cacheLayer: params.cacheSavingsUsd && params.cacheSavingsUsd > 0 ? "prompt_cache" : null,
        cacheHit: false,
        contentId: params.contentId,
        pipelineRunId: params.pipelineRunId,
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      },
    });
  } catch (error) {
    // Don't fail the main flow if cost logging fails
    console.error("Failed to log LLM call:", error);
  }
}

/**
 * Get cost analytics for an organization.
 */
export async function getOrgCostAnalytics(organizationId: string, period?: string) {
  const targetPeriod = period ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const events = await prisma.agentCostEvent.findMany({
    where: {
      organizationId,
      period: targetPeriod,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalCost = events.reduce((sum: number, e) => sum + (e.costCents / 100), 0);
  const cacheHits = events.filter((e) => e.cacheHit).length;
  const totalCalls = events.length;
  const cacheHitRate = totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0;

  const byAgent = events.reduce((acc: Record<string, { calls: number; cost: number; cacheHits: number }>, e) => {
    if (!acc[e.agentName]) {
      acc[e.agentName] = { calls: 0, cost: 0, cacheHits: 0 };
    }
    acc[e.agentName].calls++;
    acc[e.agentName].cost += e.costCents / 100;
    if (e.cacheHit) acc[e.agentName].cacheHits++;
    return acc;
  }, {});

  const byLayer = events.reduce((acc: Record<string, { hits: number; estimatedSavings: number }>, e) => {
    const layer = e.cacheLayer ?? "no_cache";
    if (!acc[layer]) {
      acc[layer] = { hits: 0, estimatedSavings: 0 };
    }
    if (e.cacheHit) {
      acc[layer].hits++;
    }
    return acc;
  }, {});

  return {
    period: targetPeriod,
    totalCost,
    totalCalls,
    cacheHits,
    cacheHitRate,
    byAgent,
    byLayer,
  };
}
