/**
 * Shared Memory Layer
 * 
 * Vector database memory layer using pgvector in Supabase.
 * Every agent can search what's been done before — topics covered, 
 * what worked, what flopped, human edits.
 * 
 * Based on the shared-memory skill specification.
 */

// Re-export types and functions
export type { MemoryType } from "./store";
export { 
  DEFAULT_IMPORTANCE, 
  EXPIRATION_DAYS,
  type StoreMemoryParams,
  storeMemory,
  storeMemories,
} from "./store";

export type { MemoryResult, RecallParams } from "./recall";
export { recallMemories as recall } from "./recall";

export type { RecentMemoryResult, RecentParams } from "./recent";
export { getRecentMemories as recent, getRecentByTypes as recentByTypes } from "./recent";

export { 
  generateEmbedding, 
  generateEmbeddings,
  getEmbeddingConfig,
  estimateTokens,
  truncateToTokens,
} from "./embeddings";

import { recallMemories, type RecallParams, type MemoryResult } from "./recall";
import { storeMemory, storeMemories, type StoreMemoryParams, type MemoryType } from "./store";
import { getRecentMemories, getRecentByTypes, type RecentParams, type RecentMemoryResult } from "./recent";
import { estimateTokens, truncateToTokens } from "./embeddings";

/**
 * Maximum tokens allowed in memory context for prompt injection.
 * This prevents overwhelming the LLM with too much context.
 */
export const MAX_MEMORY_CONTEXT_TOKENS = 2000;

/**
 * Format memories for injection into agent prompts.
 * Truncates to stay within token limit.
 * 
 * @param memories - Array of memories to format
 * @param maxTokens - Maximum tokens allowed (default 2000)
 * @returns Formatted string for prompt injection
 */
export function formatMemoriesForPrompt(memories: MemoryResult[], maxTokens: number = MAX_MEMORY_CONTEXT_TOKENS): string {
  if (memories.length === 0) return "";

  // Sort by importance (highest first) and recency
  const sorted = [...memories].sort((a, b) => {
    const scoreA = a.importance * (a.similarity ?? a.importance);
    const scoreB = b.importance * (b.similarity ?? b.importance);
    return scoreB - scoreA;
  });

  // Build formatted block
  let block = `\n\n--- RELEVANT HISTORY ---\n`;
  
  for (const mem of sorted) {
    const memBlock = `[${mem.memory_type}] ${mem.content}`;
    block += `${memBlock}\n`;
  }
  
  block += `--- END HISTORY ---\n`;

  // Truncate if exceeds token limit
  const currentTokens = estimateTokens(block);
  if (currentTokens > maxTokens) {
    return truncateToTokens(block, maxTokens);
  }

  return block;
}

/**
 * Unified Memory API
 * 
 * This is the main entry point for agents to interact with memory.
 */
export const memory = {
  /**
   * Store a new memory after an agent executes.
   * Automatically generates embedding and sets importance/expiration.
   */
  store: storeMemory,

  /**
   * Store multiple memories efficiently.
   */
  storeMany: storeMemories,

  /**
   * Recall relevant memories using semantic search.
   * Uses vector similarity to find relevant past experiences.
   */
  recall: recallMemories,

  /**
   * Get recent memories by type (chronological).
   */
  recent: getRecentMemories,

  /**
   * Get recent memories across multiple types.
   */
  recentByTypes: getRecentByTypes,

  /**
   * Format memories for prompt injection.
   */
  formatForPrompt: formatMemoriesForPrompt,
};

export default memory;
