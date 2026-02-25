-- Create Goal and GoalCheckpoint tables for goal tracking

-- Goals: client-stated objectives with targets and progress
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 1,
    targets JSONB NOT NULL,
    current_progress JSONB,
    adjustments JSONB,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    target_date TIMESTAMPTZ,
    achieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_org_active ON goals (organization_id, is_active);

-- Goal Checkpoints: periodic progress measurements
CREATE TABLE IF NOT EXISTS goal_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    target_value FLOAT NOT NULL,
    target_unit TEXT NOT NULL,
    actual_value FLOAT,
    progress_percent FLOAT,
    on_track BOOLEAN,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_goal_period ON goal_checkpoints (goal_id, period_start);
