---
name: shared-memory
description: "Vector database memory layer using pgvector in Supabase. Every agent can search what's been done before — topics covered, what worked, what flopped, human edits. Makes the system intelligent over time, not just reactive. READ THIS for any agent that needs historical context."
---

# SKILL: Shared Memory Layer

> This is a SYSTEM skill — not an agent. It's infrastructure that ALL agents use.
> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Every agent call is currently stateless. The Content Creator doesn't know it generated a post about "vitamin C benefits" three days ago. The Engagement Agent doesn't remember that a customer complained about shipping last week. The Strategy Agent can't recall which content themes have been exhausted.

The Shared Memory Layer gives every agent access to the collective memory of ALL agents. It's a searchable, semantic memory stored in pgvector (Supabase's built-in vector extension) that any agent can query: "What have we posted about recently? What topics performed well? What did the human correct? What's the audience responding to?"

This is what makes the system feel like it has a brain, not just reflexes.

---

## File Location

```
lib/memory/index.ts                → Main memory API
lib/memory/embeddings.ts           → Embedding generation
lib/memory/store.ts                → Write to memory
lib/memory/recall.ts               → Search/query memory
lib/memory/consolidation.ts        → Periodic memory cleanup and summarization
```

---

## Architecture

```
AGENT executes
    │
    ├── BEFORE execution: recall() → search relevant memories → inject into prompt
    │
    ├── DURING execution: agent runs with memory context
    │
    └── AFTER execution: store() → save result as new memory
```

Every agent call follows this pattern:
1. **Recall**: Search memory for relevant context before running
2. **Execute**: Run with memory-enriched prompt
3. **Store**: Save the output as a new memory for future agents

---

## Database

```sql
-- Enable pgvector extension in Supabase
CREATE EXTENSION IF NOT EXISTS vector;
```

```prisma
model Memory {
  id              String   @id @default(uuid())
  organizationId  String

  // Content
  content         String   @db.Text        // Human-readable memory text
  embedding       Unsupported("vector(1536)") // OpenAI ada-002 or similar embedding

  // Metadata for filtering
  memoryType      String   // "content_created", "content_published", "content_performance",
                           // "human_feedback", "human_correction", "audience_insight",
                           // "competitor_action", "trend_detected", "strategy_decision",
                           // "engagement_interaction", "crisis_event", "brand_voice_note"

  agentSource     String   // Which agent created this memory
  platform        String?  // Platform if relevant
  contentId       String?  // Related content ID if applicable
  importance      Float    @default(0.5)  // 0-1, higher = more important to recall
  accessCount     Int      @default(0)    // How often this memory has been recalled
  lastAccessedAt  DateTime?

  // Lifecycle
  expiresAt       DateTime?  // Some memories are temporary (trends, time-sensitive)
  isConsolidated  Boolean  @default(false) // Has been merged into a summary memory
  consolidatedInto String? // ID of the summary memory this was merged into

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, memoryType])
  @@index([organizationId, createdAt])
  @@index([organizationId, importance])
}
```

Raw SQL for vector similarity search (Supabase supports this natively):

```sql
-- Create index for fast similarity search
CREATE INDEX ON memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Similarity search function
CREATE OR REPLACE FUNCTION search_memory(
  org_id TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7,
  memory_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  memory_type TEXT,
  agent_source TEXT,
  importance FLOAT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.memory_type,
    m.agent_source,
    m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM memory m
  WHERE m.organization_id = org_id
    AND (memory_types IS NULL OR m.memory_type = ANY(memory_types))
    AND m.is_consolidated = false
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Memory API

```typescript
// lib/memory/index.ts

import { generateEmbedding } from "./embeddings";
import { supabase } from "@/lib/supabase";

export const memory = {

  /**
   * Store a new memory after an agent executes
   */
  async store(params: {
    organizationId: string;
    content: string;           // Human-readable description of what happened
    memoryType: MemoryType;
    agentSource: string;
    platform?: string;
    contentId?: string;
    importance?: number;       // 0-1, default 0.5
    expiresAt?: Date;          // For temporary memories (trends)
  }): Promise<void> {
    const embedding = await generateEmbedding(params.content);

    await supabase.from("memory").insert({
      organization_id: params.organizationId,
      content: params.content,
      embedding,
      memory_type: params.memoryType,
      agent_source: params.agentSource,
      platform: params.platform,
      content_id: params.contentId,
      importance: params.importance ?? 0.5,
      expires_at: params.expiresAt,
    });
  },

  /**
   * Recall relevant memories before an agent executes
   */
  async recall(params: {
    organizationId: string;
    query: string;             // What the agent is about to do / topic
    memoryTypes?: MemoryType[];
    limit?: number;
    minSimilarity?: number;
    minImportance?: number;
  }): Promise<MemoryResult[]> {
    const queryEmbedding = await generateEmbedding(params.query);

    const { data } = await supabase.rpc("search_memory", {
      org_id: params.organizationId,
      query_embedding: queryEmbedding,
      match_count: params.limit ?? 10,
      similarity_threshold: params.minSimilarity ?? 0.7,
      memory_types: params.memoryTypes ?? null,
    });

    // Update access counts
    if (data?.length) {
      await supabase
        .from("memory")
        .update({ access_count: supabase.sql`access_count + 1`, last_accessed_at: new Date() })
        .in("id", data.map(m => m.id));
    }

    return data ?? [];
  },

  /**
   * Get recent memories by type (no semantic search, just chronological)
   */
  async recent(params: {
    organizationId: string;
    memoryType: MemoryType;
    limit?: number;
    daysBack?: number;
  }): Promise<MemoryResult[]> {
    const since = new Date();
    since.setDate(since.getDate() - (params.daysBack ?? 30));

    const { data } = await supabase
      .from("memory")
      .select("*")
      .eq("organization_id", params.organizationId)
      .eq("memory_type", params.memoryType)
      .eq("is_consolidated", false)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(params.limit ?? 10);

    return data ?? [];
  },
};

type MemoryType =
  | "content_created"          // A post was generated (topic, angle, platform)
  | "content_published"        // A post went live
  | "content_performance"      // Performance data: engagement, reach, clicks
  | "human_feedback"           // Thumbs up/down, star ratings
  | "human_correction"         // Human edited agent output — what changed and why
  | "human_instruction"        // Explicit instruction from "Talk to AI"
  | "audience_insight"         // Something learned about the audience
  | "competitor_action"        // Something a competitor did
  | "trend_detected"           // A trend was found (temporary memory)
  | "strategy_decision"        // A strategic choice was made
  | "engagement_interaction"   // Notable customer interaction
  | "crisis_event"             // Crisis occurred
  | "brand_voice_note"         // Something about voice consistency
  | "performance_pattern"      // A pattern in what works/doesn't work
  | "visual_preference";       // Visual style preference learned
```

---

## Integration with BaseAgent

```typescript
// Modify BaseAgent to automatically use memory:

abstract class BaseAgent {
  async run(organizationId: string, input: unknown): Promise<AgentResult<unknown>> {
    // 1. RECALL relevant memories
    const memories = await memory.recall({
      organizationId,
      query: this.getMemoryQuery(input), // Each agent defines what to search for
      memoryTypes: this.relevantMemoryTypes(), // Each agent defines which types matter
      limit: 10,
    });

    // 2. Format memories for prompt injection
    const memoryContext = this.formatMemories(memories);

    // 3. EXECUTE with memory context
    const result = await this.execute({
      ...input,
      _memoryContext: memoryContext,
      _trainingContext: await getTrainingContext(organizationId, this.agentName),
    });

    // 4. STORE result as new memory
    await this.storeMemory(organizationId, input, result);

    return result;
  }

  // Each agent overrides these:
  abstract getMemoryQuery(input: unknown): string;
  abstract relevantMemoryTypes(): MemoryType[];
  abstract storeMemory(orgId: string, input: unknown, result: AgentResult): Promise<void>;

  protected formatMemories(memories: MemoryResult[]): string {
    if (memories.length === 0) return "";

    let block = `\n\n--- RELEVANT HISTORY ---\n`;
    for (const mem of memories) {
      block += `[${mem.memory_type}] ${mem.content}\n`;
    }
    block += `--- END HISTORY ---\n`;
    return block;
  }
}
```

---

## Example: Content Creator Using Memory

```typescript
class ContentCreatorAgent extends BaseAgent {

  getMemoryQuery(input: ContentCreatorInput): string {
    // Search for: what we've posted about this topic before
    return `${input.topic} ${input.platform} content created`;
  }

  relevantMemoryTypes(): MemoryType[] {
    return [
      "content_created",       // Don't repeat topics
      "content_performance",   // Know what works
      "human_correction",      // Learn from corrections
      "human_instruction",     // Follow explicit instructions
      "audience_insight",      // Know the audience
      "trend_detected",        // Incorporate trends
    ];
  }

  async storeMemory(orgId: string, input: any, result: AgentResult): Promise<void> {
    for (const post of result.data.posts) {
      await memory.store({
        organizationId: orgId,
        content: `Created ${post.contentType} for ${post.platform} about "${post.topic}". Hook: "${post.caption.slice(0, 80)}". Hashtags: ${post.hashtags.join(", ")}`,
        memoryType: "content_created",
        agentSource: "CONTENT_CREATOR",
        platform: post.platform,
        contentId: post.id,
        importance: 0.5,
      });
    }
  }
}
```

---

## Memory Consolidation

Memories accumulate. After 90 days, consolidate old memories into summaries:

```typescript
// lib/memory/consolidation.ts

// Runs monthly via Orchestrator
async function consolidateMemories(organizationId: string) {
  // 1. Find memories older than 90 days, grouped by type
  const oldMemories = await prisma.memory.findMany({
    where: {
      organizationId,
      createdAt: { lt: subDays(new Date(), 90) },
      isConsolidated: false,
    },
    orderBy: { createdAt: "asc" },
  });

  // 2. Group by type + month
  const groups = groupByTypeAndMonth(oldMemories);

  // 3. For each group: LLM summarizes into a single memory
  for (const group of groups) {
    const summary = await summarizeMemories(group.memories);
    // "In October 2025: Created 42 posts. Top topics: skincare tips (12),
    //  product launches (8), behind the scenes (6). Best performer:
    //  'Top 5 ingredients' carousel (8.2% engagement). Human corrected
    //  3 posts — all for being too promotional. Audience responded best
    //  to educational content on Tuesdays."

    const summaryMemory = await memory.store({
      organizationId,
      content: summary,
      memoryType: `consolidated_${group.type}`,
      agentSource: "MEMORY_CONSOLIDATION",
      importance: 0.8, // Consolidated memories are more important
    });

    // 4. Mark originals as consolidated
    await prisma.memory.updateMany({
      where: { id: { in: group.memories.map(m => m.id) } },
      data: { isConsolidated: true, consolidatedInto: summaryMemory.id },
    });
  }
}
```

---

## Rules

1. **Every agent must recall before executing.** No agent runs without checking memory first.
2. **Every agent must store after executing.** Every action becomes a memory for future agents.
3. **Memory is per-organization.** RLS enforced. No cross-org memory leakage.
4. **Consolidate, don't delete.** Old memories get summarized, never erased.
5. **Importance scoring matters.** Human corrections get importance 0.9. Routine content creation gets 0.5. The recall system surfaces high-importance memories first.
6. **Temporary memories expire.** Trend detections expire after 14 days. Crisis events expire after 30 days. Content performance never expires.
7. **Cap recall context.** Max 10 memories per agent call, max 2000 tokens of memory context in the prompt. Quality over quantity.
