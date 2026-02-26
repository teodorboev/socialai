/**
 * RLS (Row-Level Security) Setup Script
 * 
 * This script enables RLS on all tables and creates policies for multi-tenant isolation.
 * 
 * IMPORTANT: Run this in Supabase SQL Editor or via psql:
 *   psql $DIRECT_URL -f scripts/setup-rls.sql
 * 
 * Or as a migration:
 *   npx prisma migrate dev --name add_rls_policies
 */

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

-- Organizations & Users
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- Social & Content
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Engagement & Intelligence
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Agent System
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- Memory
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Goals
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;

-- Experiments
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;

-- Insights
ALTER TABLE industry_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;

-- Safety & Compliance
ALTER TABLE content_safety_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_safety_rules ENABLE ROW LEVEL SECURITY;

-- Billing
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cost_events ENABLE ROW LEVEL SECURITY;

-- Routing
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fallback_rules ENABLE ROW LEVEL SECURITY;

-- Prompts
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Settings
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION auth.get_user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM org_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ORGANIZATIONS POLICIES
-- ============================================================

-- Organizations: Users can read their own org
CREATE POLICY "Users can view own organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT auth.get_user_org_ids()));

-- Org members: Users can read org members
CREATE POLICY "Users can view org members"
  ON org_members FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- SOCIAL ACCOUNTS POLICIES
-- ============================================================

CREATE POLICY "Users can view own social accounts"
  ON social_accounts FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert to own social accounts"
  ON social_accounts FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own social accounts"
  ON social_accounts FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- BRAND CONFIG POLICIES
-- ============================================================

CREATE POLICY "Users can view own brand configs"
  ON brand_configs FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert own brand configs"
  ON brand_configs FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own brand configs"
  ON brand_configs FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- CONTENT POLICIES
-- ============================================================

CREATE POLICY "Users can view own content"
  ON content FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert own content"
  ON content FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own content"
  ON content FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can delete own content"
  ON content FOR DELETE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- SCHEDULES POLICIES
-- ============================================================

CREATE POLICY "Users can view own schedules"
  ON schedules FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert own schedules"
  ON schedules FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own schedules"
  ON schedules FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- ENGAGEMENTS POLICIES
-- ============================================================

CREATE POLICY "Users can view own engagements"
  ON engagements FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- CONTENT PLANS POLICIES
-- ============================================================

CREATE POLICY "Users can view own content plans"
  ON content_plans FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert own content plans"
  ON content_plans FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own content plans"
  ON content_plans FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- ANALYTICS POLICIES
-- ============================================================

CREATE POLICY "Users can view own analytics"
  ON analytics_snapshots FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- AGENT LOGS POLICIES
-- ============================================================

CREATE POLICY "Users can view own agent logs"
  ON agent_logs FOR SELECT
  USING (
    organization_id IS NULL 
    OR organization_id IN (SELECT auth.get_user_org_ids())
  );

-- ============================================================
-- ESCALATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view own escalations"
  ON escalations FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own escalations"
  ON escalations FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- ORG SETTINGS POLICIES
-- ============================================================

CREATE POLICY "Users can view own org settings"
  ON org_settings FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own org settings"
  ON org_settings FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- MEMORIES POLICIES
-- ============================================================

CREATE POLICY "Users can view own memories"
  ON memories FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert own memories"
  ON memories FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own memories"
  ON memories FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- BILLING POLICIES (Service role handles these)
-- ============================================================

-- Billing tables are typically managed by the system, not users directly
-- But org members should see their subscription status

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can view own billing events"
  ON billing_events FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- POSTING SCHEDULES POLICIES
-- ============================================================

CREATE POLICY "Users can view own posting schedules"
  ON posting_schedules FOR SELECT
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can insert own posting schedules"
  ON posting_schedules FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can update own posting schedules"
  ON posting_schedules FOR UPDATE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

CREATE POLICY "Users can delete own posting schedules"
  ON posting_schedules FOR DELETE
  USING (organization_id IN (SELECT auth.get_user_org_ids()));

-- ============================================================
-- VERIFY RLS IS ENABLED
-- ============================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
ORDER BY tablename;
