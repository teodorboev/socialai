import { generateEmbedding } from "./embeddings";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Memory type definitions based on the shared-memory skill spec.
 * These types categorize what kind of memory is being stored.
 */
export type MemoryType =
  | "content_created"           // A post was generated (topic, angle, platform)
  | "content_published"          // A post went live
  | "content_performance"         // Performance data: engagement, reach, clicks
  | "human_feedback"             // Thumbs up/down, star ratings
  | "human_correction"           // Human edited agent output — what changed and why
  | "human_instruction"          // Explicit instruction from "Talk to AI"
  | "audience_insight"           // Something learned about the audience
  | "competitor_action"          // Something a competitor did
  | "trend_detected"             // A trend was found (temporary memory)
  | "strategy_decision"          // A strategic choice was made
  | "engagement_interaction"     // Notable customer interaction
  | "crisis_event"               // Crisis occurred
  | "brand_voice_note"           // Something about voice consistency
  | "performance_pattern"        // A pattern in what works/doesn't work
  | "visual_preference";         // Visual style preference learned

/**
 * Default importance values based on memory type.
 * Human corrections are most important (0.9), routine content creation is default (0.5).
 */
export const DEFAULT_IMPORTANCE: Record<MemoryType, number> = {
  content_created: 0.5,
  content_published: 0.5,
  content_performance: 0.7,
  human_feedback: 0.8,
  human_correction: 0.9,       // Most important - learn from human edits
  human_instruction: 0.85,     // Explicit instructions should be remembered
  audience_insight: 0.7,
  competitor_action: 0.6,
  trend_detected: 0.4,         // Trends expire, lower importance
  strategy_decision: 0.75,
  engagement_interaction: 0.6,
  crisis_event: 0.9,           // Crises are very important to remember
  brand_voice_note: 0.7,
  performance_pattern: 0.75,
  visual_preference: 0.7,
};

/**
 * Expiration periods for temporary memories (in days)
 */
export const EXPIRATION_DAYS: Partial<Record<MemoryType, number>> = {
  trend_detected: 14,          // Trends expire after 2 weeks
  crisis_event: 30,            // Crises expire after 1 month
};

export interface StoreMemoryParams {
  organizationId: string;
  content: string;             // Human-readable description of what happened
  memoryType: MemoryType;
  agentSource: string;
  platform?: string;
  contentId?: string;
  importance?: number;         // 0-1, default varies by type
  expiresAt?: Date;            // For temporary memories (trends)
}

/**
 * Store a new memory in the vector database.
 * 
 * This function:
 * 1. Generates an embedding for the content
 * 2. Inserts the memory record into Supabase
 * 
 * @param params - Memory storage parameters
 * @returns Promise<void>
 */
export async function storeMemory(params: StoreMemoryParams): Promise<void> {
  const { 
    organizationId, 
    content, 
    memoryType, 
    agentSource, 
    platform, 
    contentId, 
    importance, 
    expiresAt 
  } = params;

  // Generate embedding for semantic search
  let embedding: number[];
  try {
    embedding = await generateEmbedding(content);
  } catch (error) {
    console.error("Failed to generate embedding for memory:", error);
    // Store without embedding if generation fails - still useful for non-semantic queries
    embedding = [];
  }

  // Get default importance for this memory type
  const defaultImportance = DEFAULT_IMPORTANCE[memoryType] ?? 0.5;
  const finalImportance = importance ?? defaultImportance;

  // Calculate expiration if not provided
  const expirationDays = EXPIRATION_DAYS[memoryType];
  const finalExpiresAt = expiresAt ?? (expirationDays 
    ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) 
    : null);

  // Insert into Supabase
  const { error } = await supabaseAdmin.from("memory").insert({
    organization_id: organizationId,
    content,
    embedding,
    memory_type: memoryType,
    agent_source: agentSource,
    platform: platform ?? null,
    content_id: contentId ?? null,
    importance: finalImportance,
    expires_at: finalExpiresAt?.toISOString() ?? null,
    is_consolidated: false,
  });

  if (error) {
    console.error("Failed to store memory:", error);
    throw new Error(`Failed to store memory: ${error.message}`);
  }
}

/**
 * Store multiple memories efficiently.
 * 
 * @param memories - Array of memory parameters
 * @returns Promise<void>
 */
export async function storeMemories(memories: StoreMemoryParams[]): Promise<void> {
  if (memories.length === 0) return;

  // Generate all embeddings in batch
  const contents = memories.map(m => m.content);
  
  let embeddings: number[][];
  try {
    embeddings = await Promise.all(contents.map(c => generateEmbedding(c).catch(() => [])));
  } catch (error) {
    console.error("Failed to generate embeddings for memories:", error);
    embeddings = memories.map(() => []);
  }

  // Prepare records for batch insert
  const records = memories.map((params, index) => {
    const defaultImportance = DEFAULT_IMPORTANCE[params.memoryType] ?? 0.5;
    const finalImportance = params.importance ?? defaultImportance;
    const expirationDays = EXPIRATION_DAYS[params.memoryType];
    const finalExpiresAt = params.expiresAt ?? (expirationDays 
      ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
      : null);

    return {
      organization_id: params.organizationId,
      content: params.content,
      embedding: embeddings[index] ?? [],
      memory_type: params.memoryType,
      agent_source: params.agentSource,
      platform: params.platform ?? null,
      content_id: params.contentId ?? null,
      importance: finalImportance,
      expires_at: finalExpiresAt?.toISOString() ?? null,
      is_consolidated: false,
    };
  });

  // Batch insert
  const { error } = await supabaseAdmin.from("memory").insert(records);

  if (error) {
    console.error("Failed to store memories:", error);
    throw new Error(`Failed to store memories: ${error.message}`);
  }
}
