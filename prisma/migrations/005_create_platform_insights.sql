-- Create PlatformInsights table for inter-client learning

CREATE TABLE IF NOT EXISTS platform_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    platform TEXT,
    pattern TEXT NOT NULL,
    supporting_data JSONB,
    confidence FLOAT DEFAULT 0.5,
    evidence_count INT DEFAULT 1,
    last_validated TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    archived_at TIMESTAMPTZ,
    archive_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_industry_type ON platform_insights (industry, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_industry_platform ON platform_insights (industry, platform);
CREATE INDEX IF NOT EXISTS idx_insights_active_confidence ON platform_insights (is_active, confidence DESC);
