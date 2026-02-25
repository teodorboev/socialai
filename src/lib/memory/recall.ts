import { generateEmbedding } from "./embeddings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MemoryType } from "./store";

export interface MemoryResult {
  id: string;
  content: string;
  memory_type: string;
  agent_source: string;
  platform: string | null;
  content_id: string | null;
  importance: number;
  similarity: number;
  created_at: string;
}

export interface RecallParams {
  organizationId: string;
  query: string;               // What the agent is about to do / topic
  memoryTypes?: MemoryType[];  // Filter by specific memory types
  limit?: number;              // Max results (default 10)
  minSimilarity?: number;      // Min similarity threshold (default 0.7)
  minImportance?: number;      // Min importance threshold (default 0)
}

/**
 * Recall relevant memories using semantic similarity search.
 * 
 * This function:
 * 1. Generates an embedding for the query
 * 2. Calls the search_memory RPC function
 * 3. Updates access counts for retrieved memories
 * 
 * @param params - Recall parameters
 * @returns Promise<MemoryResult[]> - Array of relevant memories
 */
export async function recallMemories(params: RecallParams): Promise<MemoryResult[]> {
  const { 
    organizationId, 
    query, 
    memoryTypes, 
    limit = 10, 
    minSimilarity = 0.7,
    minImportance = 0 
  } = params;

  // Generate embedding for the query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (error) {
    console.error("Failed to generate query embedding:", error);
    // Fallback to recent memories if embedding fails
    return recallRecentMemories({
      organizationId,
      memoryTypes: memoryTypes ?? undefined,
      limit,
    });
  }

  // Call the search_memory RPC function
  const { data, error } = await supabaseAdmin.rpc("search_memory", {
    org_id: organizationId,
    query_embedding: queryEmbedding,
    match_count: limit,
    similarity_threshold: minSimilarity,
    memory_types: memoryTypes ?? null,
  });

  if (error) {
    console.error("Failed to search memories:", error);
    // Fallback to recent memories if search fails
    return recallRecentMemories({
      organizationId,
      memoryTypes: memoryTypes ?? undefined,
      limit,
    });
  }

  const results = (data ?? []) as MemoryResult[];

  // Filter by minimum importance
  const filtered = minImportance > 0 
    ? results.filter(r => r.importance >= minImportance)
    : results;

  // Update access counts if we have results
  if (filtered.length > 0) {
    const ids = filtered.map(r => r.id);
    try {
      // Fetch current access counts and increment
      const { data: current } = await supabaseAdmin
        .from("memory")
        .select("id, access_count")
        .in("id", ids);

      if (current) {
        const updates = current.map(c => ({
          id: c.id,
          access_count: (c.access_count ?? 0) + 1,
          last_accessed_at: new Date().toISOString(),
        }));

        for (const update of updates) {
          await supabaseAdmin.from("memory").update({
            access_count: update.access_count,
            last_accessed_at: update.last_accessed_at,
          }).eq("id", update.id);
        }
      }
    } catch (error) {
      console.error("Failed to update access counts:", error);
      // Non-fatal, don't throw
    }
  }

  return filtered;
}

/**
 * Fallback: Get recent memories when semantic search fails.
 * Uses chronological retrieval instead of similarity.
 */
async function recallRecentMemories(params: {
  organizationId: string;
  memoryTypes?: MemoryType[];
  limit: number;
}): Promise<MemoryResult[]> {
  const { organizationId, memoryTypes, limit } = params;

  let query = supabaseAdmin
    .from("memory")
    .select("id, content, memory_type, agent_source, platform, content_id, importance, created_at")
    .eq("organization_id", organizationId)
    .eq("is_consolidated", false)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (memoryTypes && memoryTypes.length > 0) {
    query = query.in("memory_type", memoryTypes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch recent memories:", error);
    return [];
  }

  return (data ?? []).map(r => ({
    ...r,
    similarity: r.importance, // Use importance as proxy for relevance
  }));
}

export { recallMemories as recall };
