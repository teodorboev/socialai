-- Add new fields to AgentCostEvent for caching support
ALTER TABLE "agent_cost_events" ADD COLUMN IF NOT EXISTS "cache_read_tokens" INTEGER DEFAULT 0;
ALTER TABLE "agent_cost_events" ADD COLUMN IF NOT EXISTS "cache_write_tokens" INTEGER DEFAULT 0;
ALTER TABLE "agent_cost_events" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "agent_cost_events" ADD COLUMN IF NOT EXISTS "cache_layer" TEXT;
ALTER TABLE "agent_cost_events" ADD COLUMN IF NOT EXISTS "cache_hit" BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS "agent_cost_events_cache_layer_idx" ON "agent_cost_events"("cache_layer");
CREATE INDEX IF NOT EXISTS "agent_cost_events_cache_hit_idx" ON "agent_cost_events"("cache_hit");

-- Create EngagementTemplate table for Layer 3 template short-circuit
CREATE TABLE IF NOT EXISTS "engagement_templates" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
    "category" TEXT NOT NULL,
    "platform" TEXT,
    "triggers" TEXT[] DEFAULT '{}',
    "responses" TEXT[] DEFAULT '{}',
    "isActive" BOOLEAN DEFAULT true,
    "useCount" INTEGER DEFAULT 0,
    "successRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "engagement_templates_org_category_idx" ON "engagement_templates"("organization_id", "category");
