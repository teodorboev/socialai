/**
 * LLM Caching - Prompt Cache Layer
 * 
 * Implements Anthropic prompt caching wrapper.
 * 
 * Layer 2: Anthropic Prompt Caching
 * - Marks static blocks as cacheable with cache_control: ephemeral
 * - Separates static (brand voice, rules) from dynamic (current date, context) content
 * - Minimum cacheable block: 1,024 tokens (~750 words)
 * - Cache TTL: 5 min default, up to 1 hour with ephemeral
 */

import Anthropic from "@anthropic-ai/sdk";

export type CachableBlock = Anthropic.TextBlockParam & {
  cache_control?: { type: "ephemeral" };
};

/**
 * Wraps a system prompt string into Anthropic's cache_control format.
 *
 * Rules:
 * - Only the LAST block in a messages array can have cache_control.
 * - Split your system prompt into static (cacheable) + dynamic (not cached) parts.
 * - Minimum cacheable block: 1,024 tokens (~750 words). Smaller blocks are ignored by Anthropic.
 * - Cache TTL: 5 minutes default. Use "ephemeral" for up to 1 hour.
 *
 * @param staticPart - Brand voice, platform rules, agent role — changes rarely
 * @param dynamicPart - Current date, recent context — changes every call
 */
export function buildCachedSystemPrompt(
  staticPart: string,
  dynamicPart?: string
): CachableBlock[] {
  const blocks: CachableBlock[] = [
    {
      type: "text",
      text: staticPart,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (dynamicPart) {
    blocks.push({
      type: "text",
      text: dynamicPart,
      // No cache_control — this changes every call, don't cache it
    });
  }

  return blocks;
}

/**
 * Extracts cache usage stats from a Claude response.
 * Log these to agent_cost_events for the admin cost dashboard.
 */
export function extractCacheStats(usage: Anthropic.Usage): {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  regularInputTokens: number;
  estimatedSavingsUsd: number;
} {
  // Anthropic SDK types may not include cache fields, use type assertion
  const usageAny = usage as unknown as {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };

  const cacheReadTokens = usageAny.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usageAny.cache_creation_input_tokens ?? 0;
  const regularInputTokens = usageAny.input_tokens ?? 0;

  // Sonnet 4 pricing: $3/M regular input, $0.30/M cache read, $3.75/M cache write
  const REGULAR_INPUT_PRICE = 3.0; // $ per million
  const CACHE_READ_PRICE = 0.30;
  const CACHE_WRITE_PRICE = 3.75;

  const regularCost = (regularInputTokens / 1_000_000) * REGULAR_INPUT_PRICE;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * CACHE_READ_PRICE;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * CACHE_WRITE_PRICE;
  const actualCost = regularCost + cacheReadCost + cacheWriteCost;

  // What it would have cost without caching
  const uncachedCost = ((regularInputTokens + cacheReadTokens) / 1_000_000) * REGULAR_INPUT_PRICE;

  return {
    cacheReadTokens,
    cacheWriteTokens,
    regularInputTokens,
    estimatedSavingsUsd: Math.max(0, uncachedCost - actualCost),
  };
}

/**
 * Calculates cost breakdown for display in dashboard
 */
export function calculateCostBreakdown(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheWriteTokens: number = 0,
  model: string = "claude-sonnet-4-20250514"
): {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
  withoutCacheCost: number;
  savings: number;
} {
  const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    "claude-sonnet-4-20250514": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-sonnet-4-20250625": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-haiku-4-5-20251001": { input: 0.80, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
  };

  const p = PRICING[model] ?? PRICING["claude-sonnet-4-20250514"];

  const inputCost = (inputTokens / 1_000_000) * p.input;
  const outputCost = (outputTokens / 1_000_000) * p.output;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * p.cacheRead;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * p.cacheWrite;

  const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;
  const withoutCacheCost = ((inputTokens + cacheReadTokens) / 1_000_000) * p.input + outputCost;
  const savings = Math.max(0, withoutCacheCost - totalCost);

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost,
    withoutCacheCost,
    savings,
  };
}
