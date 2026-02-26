/**
 * RLS Policies Setup Script
 * 
 * Creates the helper function and RLS policies for multi-tenant isolation.
 * 
 * IMPORTANT: Run this in Supabase SQL Editor or via psql:
 *   psql $DIRECT_URL -f scripts/setup-rls-policies.sql
 */

-- ============================================================
-- HELPER FUNCTION (in public schema)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM org_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ORGANIZATIONS POLICIES
-- ============================================================

-- Organizations: Users can read their own org
CREATE POLICY "Users can view own organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));

-- ============================================================
-- ORG MEMBERS POLICIES
-- ============================================================

CREATE POLICY "Users can view org members"
  ON org_members FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- SOCIAL ACCOUNTS POLICIES
-- ============================================================

CREATE POLICY "Users can view own social accounts"
  ON social_accounts FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert to own social accounts"
  ON social_accounts FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own social accounts"
  ON social_accounts FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete own social accounts"
  ON social_accounts FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- BRAND CONFIG POLICIES
-- ============================================================

CREATE POLICY "Users can view own brand configs"
  ON brand_configs FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own brand configs"
  ON brand_configs FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own brand configs"
  ON brand_configs FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- CONTENT POLICIES
-- ============================================================

CREATE POLICY "Users can view own content"
  ON content FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own content"
  ON content FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own content"
  ON content FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete own content"
  ON content FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- SCHEDULES POLICIES
-- ============================================================

CREATE POLICY "Users can view own schedules"
  ON schedules FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own schedules"
  ON schedules FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own schedules"
  ON schedules FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete own schedules"
  ON schedules FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- ENGAGEMENTS POLICIES
-- ============================================================

CREATE POLICY "Users can view own engagements"
  ON engagements FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own engagements"
  ON engagements FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own engagements"
  ON engagements FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- CONTENT PLANS POLICIES
-- ============================================================

CREATE POLICY "Users can view own content plans"
  ON content_plans FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own content plans"
  ON content_plans FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own content plans"
  ON content_plans FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- ANALYTICS POLICIES
-- ============================================================

CREATE POLICY "Users can view own analytics"
  ON analytics_snapshots FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- AGENT LOGS POLICIES
-- ============================================================

CREATE POLICY "Users can view own agent logs"
  ON agent_logs FOR SELECT
  USING (
    organization_id IS NULL 
    OR organization_id IN (SELECT get_user_org_ids())
  );

-- ============================================================
-- ESCALATIONS POLICIES
-- ============================================================

CREATE POLICY "Users can view own escalations"
  ON escalations FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own escalations"
  ON escalations FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- ORG SETTINGS POLICIES
-- ============================================================

CREATE POLICY "Users can view own org settings"
  ON org_settings FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own org settings"
  ON org_settings FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- POSTING SCHEDULES POLICIES
-- ============================================================

CREATE POLICY "Users can view own posting schedules"
  ON posting_schedules FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own posting schedules"
  ON posting_schedules FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own posting schedules"
  ON posting_schedules FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can delete own posting schedules"
  ON posting_schedules FOR DELETE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- BILLING POLICIES
-- ============================================================

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can view own billing events"
  ON billing_events FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- GOALS POLICIES
-- ============================================================

CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================================
-- VERIFY POLICIES
-- ============================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
