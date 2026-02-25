import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MemoryType } from "./store";

export interface RecentMemoryResult {
  id: string;
  content: string;
  memory_type: string;
  agent_source: string;
  platform: string | null;
  content_id: string | null;
  importance: number;
  access_count: number;
  created_at: string;
}

export interface RecentParams {
  organizationId: string;
  memoryType: MemoryType;
  limit?: number;
  daysBack?: number;
}

/**
 * Get recent memories by type (chronological retrieval).
 * 
 * Unlike recall() which uses semantic similarity, this returns
 * the most recent memories of a specific type.
 * 
 * @param params - Recent memory parameters
 * @returns Promise<RecentMemoryResult[]>
 */
export async function getRecentMemories(params: RecentParams): Promise<RecentMemoryResult[]> {
  const { 
    organizationId, 
    memoryType, 
    limit = 10, 
    daysBack = 30 
  } = params;

  // Calculate the date threshold
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data, error } = await supabaseAdmin
    .from("memory")
    .select("id, content, memory_type, agent_source, platform, content_id, importance, access_count, created_at")
    .eq("organization_id", organizationId)
    .eq("memory_type", memoryType)
    .eq("is_consolidated", false)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch recent memories:", error);
    return [];
  }

  return (data ?? []) as RecentMemoryResult[];
}

/**
 * Get memories across multiple types.
 * 
 * @param params - Parameters with optional types array
 * @returns Promise<RecentMemoryResult[]>
 */
export async function getRecentByTypes(params: {
  organizationId: string;
  memoryTypes: MemoryType[];
  limit?: number;
  daysBack?: number;
}): Promise<RecentMemoryResult[]> {
  const { 
    organizationId, 
    memoryTypes, 
    limit = 10, 
    daysBack = 30 
  } = params;

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data, error } = await supabaseAdmin
    .from("memory")
    .select("id, content, memory_type, agent_source, platform, content_id, importance, access_count, created_at")
    .eq("organization_id", organizationId)
    .in("memory_type", memoryTypes)
    .eq("is_consolidated", false)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch recent memories by types:", error);
    return [];
  }

  return (data ?? []) as RecentMemoryResult[];
}

export { getRecentMemories as recent, getRecentByTypes as recentByTypes };
