-- Enable pgvector extension for vector similarity search
-- This migration enables the vector extension required for the Memory model

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create search_memory function for semantic similarity search
-- This function searches memories by embedding similarity with filtering options
CREATE OR REPLACE FUNCTION search_memory(
    org_id TEXT,
    query_embedding VECTOR(1536),
    match_count INT DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.7,
    memory_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    content TEXT,
    memory_type TEXT,
    agent_source TEXT,
    platform TEXT,
    content_id TEXT,
    importance FLOAT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id::TEXT,
        m.content::TEXT,
        m.memory_type::TEXT,
        m.agent_source::TEXT,
        m.platform::TEXT,
        m.content_id::TEXT,
        m.importance::FLOAT,
        (m.embedding <=> query_embedding)::FLOAT AS similarity,
        m.created_at::TIMESTAMPTZ
    FROM memory m
    WHERE m.organization_id = org_id
        AND (memory_types IS NULL OR m.memory_type = ANY(memory_types))
        AND m.is_consolidated = false
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND (m.embedding <=> query_embedding) < (1 - similarity_threshold)
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create index for faster similarity search on embeddings
-- Using ivfflat for approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS memory_embedding_idx ON memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add organization_id index for filtering
CREATE INDEX IF NOT EXISTS memory_org_idx ON memory (organization_id);

-- Add memory_type index for filtering
CREATE INDEX IF NOT EXISTS memory_type_idx ON memory (memory_type);

-- Add created_at index for sorting
CREATE INDEX IF NOT EXISTS memory_created_idx ON memory (created_at DESC);

-- Add importance index for filtering
CREATE INDEX IF NOT EXISTS memory_importance_idx ON memory (importance DESC);
