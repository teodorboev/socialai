-- Create Memory table for pgvector-based shared memory
CREATE TABLE IF NOT EXISTS memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    memory_type TEXT NOT NULL,
    agent_source TEXT NOT NULL,
    platform TEXT,
    content_id UUID,
    importance FLOAT DEFAULT 0.5,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_consolidated BOOLEAN DEFAULT FALSE,
    consolidated_into UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to organizations
ALTER TABLE memory ADD CONSTRAINT memory_organization_id_fkey 
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS memory_org_type_idx ON memory (organization_id, memory_type);
CREATE INDEX IF NOT EXISTS memory_org_created_idx ON memory (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_org_importance_idx ON memory (organization_id, importance DESC);
CREATE INDEX IF NOT EXISTS memory_embedding_idx ON memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
