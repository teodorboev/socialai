-- Create tables for ContentFingerprint, PostMortem, AgentScorecard, DNAProfile
-- These are for the self-evaluation loop

-- ContentFingerprint: DNA extracted from every piece of content
CREATE TABLE IF NOT EXISTS content_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content_id UUID UNIQUE NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    
    -- HOOK DNA
    hook_type TEXT NOT NULL,
    hook_length INT NOT NULL,
    hook_uses_number BOOLEAN DEFAULT FALSE,
    hook_uses_emoji BOOLEAN DEFAULT FALSE,
    hook_uses_you BOOLEAN DEFAULT FALSE,
    hook_emotional_tone TEXT NOT NULL,
    
    -- CONTENT DNA
    topic TEXT NOT NULL,
    subtopic TEXT,
    content_angle TEXT NOT NULL,
    content_structure TEXT NOT NULL,
    caption_length INT NOT NULL,
    paragraph_count INT NOT NULL,
    uses_line_breaks BOOLEAN DEFAULT FALSE,
    readability_level TEXT NOT NULL,
    call_to_action TEXT,
    cta_placement TEXT,
    
    -- VISUAL DNA
    visual_type TEXT,
    visual_provider TEXT,
    dominant_color TEXT,
    brightness TEXT,
    has_text BOOLEAN DEFAULT FALSE,
    text_amount TEXT,
    has_product BOOLEAN DEFAULT FALSE,
    has_person BOOLEAN DEFAULT FALSE,
    layout TEXT,
    slide_count INT,
    
    -- TIMING DNA
    day_of_week INT NOT NULL,
    hour_of_day INT NOT NULL,
    is_weekend BOOLEAN DEFAULT FALSE,
    seasonal_context TEXT,
    
    -- DISTRIBUTION DNA
    hashtag_count INT NOT NULL,
    hashtag_mix TEXT,
    mentions_count INT DEFAULT 0,
    has_location BOOLEAN DEFAULT FALSE,
    
    -- PERFORMANCE (filled after 7 days)
    engagement_rate FLOAT,
    reach_rate FLOAT,
    save_rate FLOAT,
    share_rate FLOAT,
    comment_rate FLOAT,
    impressions INT,
    reach INT,
    likes INT,
    comments INT,
    shares INT,
    saves INT,
    clicks INT,
    percentile_rank FLOAT,
    
    -- Status
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fingerprint_org_platform ON content_fingerprints (organization_id, platform);
CREATE INDEX IF NOT EXISTS idx_fingerprint_org_evaluated ON content_fingerprints (organization_id, evaluated_at);
CREATE INDEX IF NOT EXISTS idx_fingerprint_org_hook ON content_fingerprints (organization_id, hook_type);
CREATE INDEX IF NOT EXISTS idx_fingerprint_org_topic ON content_fingerprints (organization_id, topic);

-- PostMortem: 7-day evaluation results
CREATE TABLE IF NOT EXISTS post_mortems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content_id UUID UNIQUE NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    actual_performance JSONB NOT NULL,
    agent_evaluations JSONB NOT NULL,
    overall_verdict TEXT NOT NULL,
    key_learnings TEXT[],
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postmortem_org_evaluated ON post_mortems (organization_id, evaluated_at);
CREATE INDEX IF NOT EXISTS idx_postmortem_org_verdict ON post_mortems (organization_id, overall_verdict);

-- AgentScorecard: cumulative accuracy per agent
CREATE TABLE IF NOT EXISTS agent_scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    period TEXT NOT NULL,
    total_evaluations INT DEFAULT 0,
    avg_accuracy FLOAT DEFAULT 0,
    trend TEXT,
    top_lessons TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, agent_name, period)
);

-- DNAProfile: aggregated winning/losing patterns
CREATE TABLE IF NOT EXISTS dna_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    
    -- Winning DNA
    winning_hooks TEXT[],
    winning_topics TEXT[],
    winning_angles TEXT[],
    winning_structures TEXT[],
    winning_visual_types TEXT[],
    winning_days INT[],
    winning_hours INT[],
    winning_hashtag_mix TEXT,
    
    -- Losing DNA
    losing_hooks TEXT[],
    losing_topics TEXT[],
    losing_angles TEXT[],
    
    -- Fatigue scores
    hook_fatigue JSONB DEFAULT '{}',
    topic_fatigue JSONB DEFAULT '{}',
    angle_fatigue JSONB DEFAULT '{}',
    
    -- Stats
    total_posts_analyzed INT DEFAULT 0,
    hit_rate FLOAT DEFAULT 0,
    avg_engagement FLOAT DEFAULT 0,
    
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, platform)
);
