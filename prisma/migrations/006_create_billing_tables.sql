-- Create billing tables for Stripe integration
-- Step 1: Billing Plan Definitions

-- Billing Plans table
CREATE TABLE "billing_plans" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "isPublic" BOOLEAN DEFAULT true,
    "sortOrder" INTEGER DEFAULT 0,
    "trialDays" INTEGER DEFAULT 14,
    "maxPlatforms" INTEGER NOT NULL,
    "maxPostsPerMonth" INTEGER NOT NULL,
    "maxBrands" INTEGER DEFAULT 1,
    "maxTeamMembers" INTEGER DEFAULT 1,
    "agentTier" TEXT NOT NULL,
    "enabledAgents" TEXT[] DEFAULT '{}',
    "features" JSONB DEFAULT '{}',
    "isUsageBased" BOOLEAN DEFAULT false,
    "usageUnitName" TEXT,
    "usageIncluded" INTEGER,
    "overagePerUnit" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- Stripe Plan Prices (one per currency × interval)
CREATE TABLE "stripe_plan_prices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "billing_plan_id" UUID NOT NULL REFERENCES "billing_plans"(id) ON DELETE CASCADE,
    "currency" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "unitAmount" INTEGER NOT NULL,
    "stripe_product_id" TEXT,
    "stripe_price_id" TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    UNIQUE("billing_plan_id", "currency", "interval")
);

CREATE INDEX IF NOT EXISTS "stripe_plan_prices_stripe_price_id_idx" ON "stripe_plan_prices"("stripe_price_id");

-- Subscriptions table
CREATE TABLE "subscriptions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"(id) ON DELETE CASCADE,
    "billing_plan_id" UUID NOT NULL REFERENCES "billing_plans"(id),
    "stripe_customer_id" TEXT NOT NULL UNIQUE,
    "stripe_subscription_id" TEXT NOT NULL UNIQUE,
    "stripe_price_id" TEXT NOT NULL,
    "stripe_subscription_item_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "currency" TEXT DEFAULT 'usd',
    "interval" TEXT DEFAULT 'month',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "trial_start" TIMESTAMPTZ,
    "trial_end" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN DEFAULT false,
    "canceled_at" TIMESTAMPTZ,
    "cancellation_reason" TEXT,
    "current_usage" INTEGER DEFAULT 0,
    "failed_payment_count" INTEGER DEFAULT 0,
    "last_payment_failed_at" TIMESTAMPTZ,
    "dunning_step" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

-- Note: Foreign key from organizations to subscriptions is handled via Prisma relation
-- Not adding FK constraint here to avoid issues with existing organizations

-- Billing Events log (for idempotency)
CREATE TABLE "billing_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID REFERENCES "organizations"(id) ON DELETE CASCADE,
    "event_type" TEXT NOT NULL,
    "stripe_event_id" TEXT UNIQUE,
    "data" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "billing_events_org_event_type_idx" ON "billing_events"("organization_id", "event_type");
CREATE INDEX IF NOT EXISTS "billing_events_stripe_event_id_idx" ON "billing_events"("stripe_event_id");

-- Agent Cost Events (for usage tracking)
CREATE TABLE "agent_cost_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
    "agent_name" TEXT NOT NULL,
    "input_tokens" INTEGER DEFAULT 0,
    "output_tokens" INTEGER DEFAULT 0,
    "total_tokens" INTEGER DEFAULT 0,
    "cost_cents" FLOAT DEFAULT 0,
    "model" TEXT,
    "content_id" UUID,
    "pipeline_run_id" UUID,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_cost_events_org_period_idx" ON "agent_cost_events"("organization_id", "period");
CREATE INDEX IF NOT EXISTS "agent_cost_events_org_agent_period_idx" ON "agent_cost_events"("organization_id", "agent_name", "period");
CREATE INDEX IF NOT EXISTS "agent_cost_events_created_at_idx" ON "agent_cost_events"("createdAt");

-- Add RLS policies (optional - depends on your security requirements)
-- ALTER TABLE "billing_plans" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "stripe_plan_prices" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "agent_cost_events" ENABLE ROW LEVEL SECURITY;
