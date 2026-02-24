# AI-Native Social Media Management Platform — Coding Instructions

> **Purpose**: This document is the single source of truth for building the platform. Follow these instructions precisely. When in doubt, refer back to the architecture decisions and patterns defined here. Do not deviate from the stack or patterns without explicit approval.

---

## 1. Project Identity

- **Project Name**: `socialai` (working name — can be changed later)
- **What It Is**: A fully AI-automated social media management platform for B2C brands and small businesses
- **Core Principle**: AI agents ARE the workforce. Humans only handle executive decisions and finance. Every feature you build should maximize agent autonomy and minimize human intervention.
- **Target Users**: Small businesses (1–50 employees), solopreneurs, DTC brands, growth-stage B2C companies

---

## 2. Tech Stack (Non-Negotiable)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 16 (App Router) | Use Server Components by default, Client Components only when needed. Turbopack is the default bundler. Use `proxy.ts` instead of `middleware.ts`. Use `'use cache'` directive for caching (Cache Components). React Compiler enabled. |
| **Language** | TypeScript (strict mode) | No `any` types. Ever. |
| **Styling** | Tailwind CSS v4 + shadcn/ui | All UI components from shadcn. Tailwind v4 uses CSS-first config (`@theme` in CSS, no `tailwind.config.ts`). No custom CSS unless absolutely necessary |
| **Database** | Supabase (PostgreSQL) | Auth, Realtime, Storage, Edge Functions — all through Supabase |
| **ORM** | Prisma | Schema-first. All DB changes through Prisma migrations |
| **Auth** | Supabase Auth exclusively | No Clerk. No NextAuth. Supabase Auth only. |
| **API Layer** | Next.js Route Handlers + Server Actions | tRPC optional if complexity warrants it later |
| **AI/LLM** | Anthropic Claude API (primary) | Use structured outputs (tool_use) for all agent responses |
| **Image Gen** | OpenAI DALL-E 3 API or Replicate (Flux) | Abstract behind a provider interface |
| **Job Queue** | Inngest or BullMQ + Redis | For agent orchestration, scheduled tasks, retries |
| **Hosting** | Vercel (frontend) + Railway or Fly.io (workers) | Supabase handles data layer |
| **Payments** | Stripe | Subscriptions, metered billing, invoices |
| **Monitoring** | Sentry + PostHog | Error tracking + product analytics |
| **Email** | Resend | Transactional emails, reports |

---

## 3. Project Structure

```
socialai/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/
│       │   ├── (auth)/               # Auth routes (login, signup, callback)
│       │   │   ├── login/page.tsx
│       │   │   ├── signup/page.tsx
│       │   │   └── callback/route.ts
│       │   ├── (dashboard)/          # Protected dashboard routes
│       │   │   ├── layout.tsx        # Dashboard shell with sidebar
│       │   │   ├── page.tsx          # Dashboard overview
│       │   │   ├── content/          # Content management
│       │   │   │   ├── page.tsx      # Content calendar view
│       │   │   │   ├── create/page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   ├── review/           # Human review queue
│       │   │   │   └── page.tsx
│       │   │   ├── engagement/       # Comments, DMs, mentions
│       │   │   │   └── page.tsx
│       │   │   ├── analytics/        # Performance dashboards
│       │   │   │   └── page.tsx
│       │   │   ├── accounts/         # Connected social accounts
│       │   │   │   └── page.tsx
│       │   │   ├── brand/            # Brand voice configuration
│       │   │   │   └── page.tsx
│       │   │   ├── settings/         # Account & billing settings
│       │   │   │   └── page.tsx
│       │   │   └── escalations/      # Items needing human attention
│       │   │       └── page.tsx
│       │   ├── (marketing)/          # Public marketing pages
│       │   │   ├── page.tsx          # Landing page
│       │   │   └── pricing/page.tsx
│       │   ├── api/
│       │   │   ├── webhooks/
│       │   │   │   ├── stripe/route.ts
│       │   │   │   ├── meta/route.ts
│       │   │   │   └── inngest/route.ts
│       │   │   ├── social/           # Social platform API routes
│       │   │   │   ├── meta/route.ts
│       │   │   │   ├── tiktok/route.ts
│       │   │   │   ├── twitter/route.ts
│       │   │   │   └── linkedin/route.ts
│       │   │   └── agents/           # Agent trigger endpoints
│       │   │       └── route.ts
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   ├── dashboard/            # Dashboard-specific components
│       │   ├── content/              # Content management components
│       │   ├── review/               # Review queue components
│       │   └── onboarding/           # Onboarding flow components
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts         # Browser client
│       │   │   ├── server.ts         # Server client (cookies-based)
│       │   │   ├── admin.ts          # Service role client (for agents)
│       │   │   └── middleware.ts     # Auth middleware helper
│       │   ├── ai/
│       │   │   ├── claude.ts         # Claude API client with retry logic
│       │   │   ├── prompts/          # All system prompts organized by agent
│       │   │   │   ├── content-creator.ts
│       │   │   │   ├── engagement.ts
│       │   │   │   ├── strategy.ts
│       │   │   │   ├── analytics.ts
│       │   │   │   └── trend-scout.ts
│       │   │   └── schemas/          # Zod schemas for structured AI outputs
│       │   │       ├── content.ts
│       │   │       ├── strategy.ts
│       │   │       └── engagement.ts
│       │   ├── social/               # Social platform SDK wrappers
│       │   │   ├── meta.ts
│       │   │   ├── tiktok.ts
│       │   │   ├── twitter.ts
│       │   │   ├── linkedin.ts
│       │   │   └── types.ts          # Shared types across platforms
│       │   ├── stripe.ts
│       │   ├── resend.ts
│       │   └── utils.ts
│       ├── agents/                   # Agent implementations
│       │   ├── orchestrator.ts       # Central coordinator
│       │   ├── content-creator.ts    # Content generation agent
│       │   ├── publisher.ts          # Publishing agent
│       │   ├── engagement.ts         # Comment/DM response agent
│       │   ├── analytics.ts          # Analytics & reporting agent
│       │   ├── strategy.ts           # Strategy planning agent
│       │   ├── trend-scout.ts        # Trend detection agent
│       │   ├── visual.ts             # Image/video generation agent
│       │   ├── ab-testing.ts         # A/B testing agent
│       │   └── shared/
│       │       ├── confidence.ts     # Confidence scoring utilities
│       │       ├── escalation.ts     # Escalation logic
│       │       └── logger.ts         # Agent action audit logger
│       ├── inngest/                  # Inngest function definitions
│       │   ├── client.ts
│       │   └── functions/
│       │       ├── content-pipeline.ts
│       │       ├── publish-scheduled.ts
│       │       ├── engagement-monitor.ts
│       │       ├── analytics-report.ts
│       │       └── trend-scan.ts
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
├── packages/
│   └── shared/                       # Shared types, utils, constants
│       ├── types/
│       └── constants/
├── .env.local
├── .env.example
├── package.json
├── tsconfig.json
└── turbo.json                        # If using Turborepo (optional for MVP)
```

**Important**: For MVP, skip the monorepo / `apps/` / `packages/` structure. Use a flat Next.js project. Only refactor to monorepo when you have workers that need to run separately.

---

## 4. Database Schema (Prisma)

This is the core data model. Implement this exactly. Every table uses UUIDs as primary keys and has `created_at` / `updated_at` timestamps.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ============================================================
// ORGANIZATIONS & USERS
// ============================================================

model Organization {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String
  slug              String              @unique
  plan              Plan                @default(STARTER)
  stripeCustomerId  String?             @unique @map("stripe_customer_id")
  stripeSubId       String?             @unique @map("stripe_subscription_id")
  trialEndsAt       DateTime?           @map("trial_ends_at")
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  members           OrgMember[]
  socialAccounts    SocialAccount[]
  brandConfig       BrandConfig?
  content           Content[]
  schedules         Schedule[]
  engagements       Engagement[]
  analyticsSnapshots AnalyticsSnapshot[]
  agentLogs         AgentLog[]
  escalations       Escalation[]
  contentPlans      ContentPlan[]

  @@map("organizations")
}

enum Plan {
  STARTER
  GROWTH
  PRO
  ENTERPRISE
  MANAGED_STANDARD
  MANAGED_PREMIUM
  WHITE_LABEL
}

model OrgMember {
  id             String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId String       @map("organization_id") @db.Uuid
  userId         String       @map("user_id") @db.Uuid // Maps to Supabase auth.users
  role           MemberRole   @default(MEMBER)
  createdAt      DateTime     @default(now()) @map("created_at")

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@map("org_members")
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
}

// ============================================================
// SOCIAL ACCOUNTS
// ============================================================

model SocialAccount {
  id              String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId  String       @map("organization_id") @db.Uuid
  platform        Platform
  platformUserId  String       @map("platform_user_id")
  platformUsername String?     @map("platform_username")
  accessToken     String       @map("access_token")    // Encrypted at rest
  refreshToken    String?      @map("refresh_token")    // Encrypted at rest
  tokenExpiresAt  DateTime?    @map("token_expires_at")
  scopes          String[]     @default([])
  isActive        Boolean      @default(true) @map("is_active")
  metadata        Json?                                   // Platform-specific data
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  content         Content[]
  schedules       Schedule[]
  engagements     Engagement[]
  analyticsSnapshots AnalyticsSnapshot[]

  @@unique([organizationId, platform, platformUserId])
  @@map("social_accounts")
}

enum Platform {
  INSTAGRAM
  FACEBOOK
  TIKTOK
  TWITTER
  LINKEDIN
}

// ============================================================
// BRAND CONFIGURATION
// ============================================================

model BrandConfig {
  id               String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String       @unique @map("organization_id") @db.Uuid
  brandName        String       @map("brand_name")
  industry         String?
  targetAudience   Json?        @map("target_audience")    // { demographics, interests, pain_points }
  voiceTone        Json         @map("voice_tone")          // { adjectives: [], examples: [], avoid: [] }
  contentThemes    String[]     @default([]) @map("content_themes")
  hashtagStrategy  Json?        @map("hashtag_strategy")    // { always: [], never: [], rotating: [] }
  competitors      Json?                                      // [{ name, platform, handle }]
  brandColors      Json?        @map("brand_colors")         // { primary, secondary, accent }
  doNots           String[]     @default([]) @map("do_nots") // Things the AI should never say/do
  samplePosts      Json?        @map("sample_posts")         // Examples of on-brand content
  faqKnowledge     Json?        @map("faq_knowledge")        // For engagement agent
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("brand_configs")
}

// ============================================================
// CONTENT
// ============================================================

model Content {
  id               String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String          @map("organization_id") @db.Uuid
  socialAccountId  String?         @map("social_account_id") @db.Uuid
  platform         Platform
  contentType      ContentType     @map("content_type")
  status           ContentStatus   @default(DRAFT)
  caption          String
  hashtags         String[]        @default([])
  mediaUrls        String[]        @default([]) @map("media_urls")   // Supabase Storage URLs
  mediaType        MediaType?      @map("media_type")
  altText          String?         @map("alt_text")
  linkUrl          String?         @map("link_url")
  platformPostId   String?         @map("platform_post_id")           // ID after publishing
  confidenceScore  Float           @default(0) @map("confidence_score")
  agentNotes       String?         @map("agent_notes")                // Why this content was created
  rejectionReason  String?         @map("rejection_reason")
  abTestGroup      String?         @map("ab_test_group")              // A/B test identifier
  contentPlanId    String?         @map("content_plan_id") @db.Uuid
  publishedAt      DateTime?       @map("published_at")
  createdAt        DateTime        @default(now()) @map("created_at")
  updatedAt        DateTime        @updatedAt @map("updated_at")

  organization     Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  socialAccount    SocialAccount?  @relation(fields: [socialAccountId], references: [id])
  contentPlan      ContentPlan?    @relation(fields: [contentPlanId], references: [id])
  schedule         Schedule?
  engagements      Engagement[]

  @@index([organizationId, status])
  @@index([organizationId, platform, createdAt])
  @@map("content")
}

enum ContentType {
  POST
  STORY
  REEL
  CAROUSEL
  THREAD
  ARTICLE
  POLL
}

enum ContentStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  SCHEDULED
  PUBLISHING
  PUBLISHED
  FAILED
  REJECTED
}

enum MediaType {
  IMAGE
  VIDEO
  CAROUSEL_IMAGES
  CAROUSEL_MIXED
  GIF
}

// ============================================================
// SCHEDULES
// ============================================================

model Schedule {
  id               String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String        @map("organization_id") @db.Uuid
  contentId        String        @unique @map("content_id") @db.Uuid
  socialAccountId  String        @map("social_account_id") @db.Uuid
  scheduledFor     DateTime      @map("scheduled_for")
  publishedAt      DateTime?     @map("published_at")
  status           ScheduleStatus @default(PENDING)
  retryCount       Int           @default(0) @map("retry_count")
  lastError        String?       @map("last_error")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  organization     Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  content          Content       @relation(fields: [contentId], references: [id], onDelete: Cascade)
  socialAccount    SocialAccount @relation(fields: [socialAccountId], references: [id])

  @@index([status, scheduledFor])
  @@map("schedules")
}

enum ScheduleStatus {
  PENDING
  PUBLISHING
  PUBLISHED
  FAILED
  CANCELLED
}

// ============================================================
// ENGAGEMENT
// ============================================================

model Engagement {
  id                 String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId     String             @map("organization_id") @db.Uuid
  socialAccountId    String             @map("social_account_id") @db.Uuid
  contentId          String?            @map("content_id") @db.Uuid
  platform           Platform
  engagementType     EngagementType     @map("engagement_type")
  platformEngagementId String?          @map("platform_engagement_id")
  authorName         String?            @map("author_name")
  authorUsername     String?            @map("author_username")
  authorProfileUrl   String?            @map("author_profile_url")
  body               String?
  sentiment          Sentiment?
  aiResponse         String?            @map("ai_response")
  aiResponseStatus   AIResponseStatus   @default(PENDING) @map("ai_response_status")
  confidenceScore    Float?             @map("confidence_score")
  isEscalated        Boolean            @default(false) @map("is_escalated")
  respondedAt        DateTime?          @map("responded_at")
  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  organization       Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  socialAccount      SocialAccount      @relation(fields: [socialAccountId], references: [id])
  content            Content?           @relation(fields: [contentId], references: [id])

  @@index([organizationId, aiResponseStatus])
  @@index([organizationId, isEscalated])
  @@map("engagements")
}

enum EngagementType {
  COMMENT
  DIRECT_MESSAGE
  MENTION
  REPLY
  QUOTE
}

enum Sentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
  URGENT
}

enum AIResponseStatus {
  PENDING
  AUTO_RESPONDED
  PENDING_REVIEW
  APPROVED
  REJECTED
  SKIPPED
}

// ============================================================
// CONTENT PLANS (Strategy Agent Output)
// ============================================================

model ContentPlan {
  id               String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String       @map("organization_id") @db.Uuid
  title            String
  periodStart      DateTime     @map("period_start")
  periodEnd        DateTime     @map("period_end")
  strategy         Json                                  // Full strategy document from AI
  themes           String[]     @default([])
  platformMix      Json         @map("platform_mix")     // { instagram: 40, tiktok: 30, ... }
  postsPerWeek     Json         @map("posts_per_week")   // { instagram: 5, tiktok: 3, ... }
  status           PlanStatus   @default(DRAFT)
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  content          Content[]

  @@index([organizationId, periodStart])
  @@map("content_plans")
}

enum PlanStatus {
  DRAFT
  ACTIVE
  COMPLETED
  ARCHIVED
}

// ============================================================
// ANALYTICS
// ============================================================

model AnalyticsSnapshot {
  id               String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String        @map("organization_id") @db.Uuid
  socialAccountId  String        @map("social_account_id") @db.Uuid
  platform         Platform
  snapshotDate     DateTime      @map("snapshot_date") @db.Date
  followers        Int?
  followersChange  Int?          @map("followers_change")
  impressions      Int?
  reach            Int?
  engagementRate   Float?        @map("engagement_rate")
  clicks           Int?
  shares           Int?
  saves            Int?
  topContent       Json?         @map("top_content")
  rawData          Json?         @map("raw_data")
  createdAt        DateTime      @default(now()) @map("created_at")

  organization     Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  socialAccount    SocialAccount @relation(fields: [socialAccountId], references: [id])

  @@unique([socialAccountId, snapshotDate])
  @@index([organizationId, snapshotDate])
  @@map("analytics_snapshots")
}

// ============================================================
// AGENT LOGS (Full Audit Trail)
// ============================================================

model AgentLog {
  id               String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String?      @map("organization_id") @db.Uuid
  agentName        AgentName    @map("agent_name")
  action           String
  inputSummary     Json?        @map("input_summary")
  outputSummary    Json?        @map("output_summary")
  confidenceScore  Float?       @map("confidence_score")
  durationMs       Int?         @map("duration_ms")
  tokensUsed       Int?         @map("tokens_used")
  costEstimate     Float?       @map("cost_estimate")    // Track AI costs per action
  status           AgentLogStatus @default(SUCCESS)
  errorMessage     String?      @map("error_message")
  createdAt        DateTime     @default(now()) @map("created_at")

  organization     Organization? @relation(fields: [organizationId], references: [id])

  @@index([organizationId, agentName, createdAt])
  @@index([agentName, createdAt])
  @@map("agent_logs")
}

enum AgentName {
  ORCHESTRATOR
  STRATEGY
  CONTENT_CREATOR
  VISUAL
  PUBLISHER
  ENGAGEMENT
  ANALYTICS
  TREND_SCOUT
  AB_TESTING
}

enum AgentLogStatus {
  SUCCESS
  FAILED
  ESCALATED
}

// ============================================================
// ESCALATIONS
// ============================================================

model Escalation {
  id               String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  organizationId   String            @map("organization_id") @db.Uuid
  agentName        AgentName         @map("agent_name")
  reason           String
  context          Json                                  // Full context for human reviewer
  referenceType    String?           @map("reference_type")  // "content", "engagement", etc.
  referenceId      String?           @map("reference_id") @db.Uuid
  priority         EscalationPriority @default(MEDIUM)
  status           EscalationStatus  @default(OPEN)
  resolvedBy       String?           @map("resolved_by") @db.Uuid
  resolution       String?
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  organization     Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, status, priority])
  @@map("escalations")
}

enum EscalationPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum EscalationStatus {
  OPEN
  IN_REVIEW
  RESOLVED
  DISMISSED
}
```

---

## 5. Supabase Configuration

### 5.1 Row-Level Security (RLS)

**Every table must have RLS enabled.** This is critical for multi-tenant isolation.

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM org_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Example RLS policy pattern (apply to all org-scoped tables):
CREATE POLICY "Users can view own org data"
  ON content FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can insert to own org"
  ON content FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can update own org data"
  ON content FOR UPDATE
  USING (organization_id IN (SELECT get_user_org_ids()));

-- Service role (for agents) bypasses RLS automatically
-- Agents use supabase.admin client which uses service_role key
```

### 5.2 Supabase Auth Setup

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}

// lib/supabase/admin.ts — FOR AGENTS ONLY
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypasses RLS
);
```

### 5.3 Proxy (replaces middleware.ts in Next.js 16)

```typescript
// proxy.ts (NOT middleware.ts — renamed in Next.js 16)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from dashboard
  if (!user && request.nextUrl.pathname.startsWith("/(dashboard)")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

// Note: proxy.ts in Next.js 16 runs on Node.js runtime (not Edge).
// No config export needed — proxy.ts applies to all routes by default.
// Use route matching logic inside the function body.
```

---

## 6. AI Agent Implementation Patterns

### 6.1 Base Agent Pattern

Every agent follows this pattern. No exceptions.

```typescript
// agents/shared/base-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AgentName, AgentLogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface AgentResult<T> {
  success: boolean;
  data?: T;
  confidenceScore: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  tokensUsed: number;
}

export abstract class BaseAgent {
  protected client: Anthropic;
  protected agentName: AgentName;

  constructor(agentName: AgentName) {
    this.agentName = agentName;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  // Every agent must implement this
  abstract execute(input: unknown): Promise<AgentResult<unknown>>;

  // Wraps execution with logging, error handling, and escalation
  async run(organizationId: string, input: unknown): Promise<AgentResult<unknown>> {
    const startTime = Date.now();

    try {
      const result = await this.execute(input);
      const durationMs = Date.now() - startTime;

      // Log the action
      await prisma.agentLog.create({
        data: {
          organizationId,
          agentName: this.agentName,
          action: this.constructor.name,
          inputSummary: this.sanitizeForLog(input),
          outputSummary: this.sanitizeForLog(result.data),
          confidenceScore: result.confidenceScore,
          durationMs,
          tokensUsed: result.tokensUsed,
          costEstimate: this.estimateCost(result.tokensUsed),
          status: result.shouldEscalate ? AgentLogStatus.ESCALATED : AgentLogStatus.SUCCESS,
        },
      });

      // Auto-escalate if needed
      if (result.shouldEscalate) {
        await this.escalate(organizationId, result.escalationReason || "Low confidence", input);
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      await prisma.agentLog.create({
        data: {
          organizationId,
          agentName: this.agentName,
          action: this.constructor.name,
          inputSummary: this.sanitizeForLog(input),
          durationMs,
          status: AgentLogStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  }

  protected async escalate(organizationId: string, reason: string, context: unknown) {
    await prisma.escalation.create({
      data: {
        organizationId,
        agentName: this.agentName,
        reason,
        context: context as any,
        priority: "MEDIUM",
        status: "OPEN",
      },
    });

    // TODO: Send realtime notification via Supabase Realtime
    // TODO: Send email notification via Resend
  }

  private sanitizeForLog(data: unknown): any {
    // Truncate large payloads for logging
    const str = JSON.stringify(data);
    if (str && str.length > 5000) {
      return { _truncated: true, preview: str.slice(0, 2000) };
    }
    return data;
  }

  private estimateCost(tokens: number): number {
    // Claude Sonnet pricing estimate (input + output averaged)
    return (tokens / 1_000_000) * 7.5;
  }
}
```

### 6.2 Content Creator Agent

```typescript
// agents/content-creator.ts
import { BaseAgent } from "./shared/base-agent";
import { z } from "zod";

// Structured output schema
const ContentOutputSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  contentType: z.enum(["POST", "STORY", "REEL", "CAROUSEL", "THREAD"]),
  mediaPrompt: z.string().optional().describe("Prompt for image/video generation if visual content is needed"),
  altText: z.string().optional(),
  platformNotes: z.string().optional().describe("Any platform-specific considerations"),
  confidenceScore: z.number().min(0).max(1),
  reasoning: z.string().describe("Brief explanation of content choices"),
});

type ContentOutput = z.infer<typeof ContentOutputSchema>;

interface ContentCreatorInput {
  organizationId: string;
  platform: string;
  brandConfig: {
    brandName: string;
    voiceTone: any;
    contentThemes: string[];
    doNots: string[];
    targetAudience: any;
    hashtagStrategy: any;
  };
  contentPlanContext?: string;
  trendContext?: string;
  previousTopPerformers?: any[];
}

export class ContentCreatorAgent extends BaseAgent {
  constructor() {
    super("CONTENT_CREATOR");
  }

  async execute(input: ContentCreatorInput) {
    const systemPrompt = `You are an expert social media content creator for ${input.brandConfig.brandName}.

BRAND VOICE:
${JSON.stringify(input.brandConfig.voiceTone, null, 2)}

TARGET AUDIENCE:
${JSON.stringify(input.brandConfig.targetAudience, null, 2)}

CONTENT THEMES: ${input.brandConfig.contentThemes.join(", ")}

THINGS TO NEVER DO OR SAY:
${input.brandConfig.doNots.map(d => `- ${d}`).join("\n")}

HASHTAG STRATEGY:
${JSON.stringify(input.brandConfig.hashtagStrategy, null, 2)}

PLATFORM: ${input.platform}

${input.contentPlanContext ? `CURRENT CONTENT PLAN CONTEXT:\n${input.contentPlanContext}` : ""}

${input.trendContext ? `TRENDING TOPICS TO CONSIDER:\n${input.trendContext}` : ""}

${input.previousTopPerformers?.length ? `TOP PERFORMING CONTENT (use as inspiration for style/format):\n${JSON.stringify(input.previousTopPerformers, null, 2)}` : ""}

INSTRUCTIONS:
1. Create ONE piece of content for ${input.platform} that is on-brand, engaging, and optimized for the platform.
2. Match the brand voice exactly. The content should sound like it was written by the brand, not by AI.
3. Include relevant hashtags based on the strategy.
4. If visual content would enhance the post, include a detailed media prompt.
5. Rate your confidence (0-1) in how well this matches the brand voice and will perform.
6. Provide brief reasoning for your choices.

Respond with a JSON object matching the required schema.`;

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create a new ${input.platform} post. Make it authentic, engaging, and true to the brand voice. Today is ${new Date().toISOString().split("T")[0]}.`,
        },
      ],
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

    // Parse and validate
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = ContentOutputSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate: parsed.confidenceScore < 0.75,
      escalationReason: parsed.confidenceScore < 0.75
        ? `Content confidence too low (${parsed.confidenceScore}): ${parsed.reasoning}`
        : undefined,
      tokensUsed,
    };
  }
}
```

### 6.3 Engagement Agent

```typescript
// agents/engagement.ts
import { BaseAgent } from "./shared/base-agent";
import { z } from "zod";

const EngagementResponseSchema = z.object({
  response: z.string(),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "URGENT"]),
  confidenceScore: z.number().min(0).max(1),
  shouldRespond: z.boolean().describe("Whether to respond at all — some comments don't need a reply"),
  reasoning: z.string(),
});

interface EngagementInput {
  organizationId: string;
  platform: string;
  brandConfig: {
    brandName: string;
    voiceTone: any;
    faqKnowledge: any;
    doNots: string[];
  };
  engagementType: string;
  authorName: string;
  body: string;
  contentContext?: string; // The original post this is about
  conversationHistory?: Array<{ author: string; body: string }>;
}

export class EngagementAgent extends BaseAgent {
  constructor() {
    super("ENGAGEMENT");
  }

  async execute(input: EngagementInput) {
    const systemPrompt = `You are the social media community manager for ${input.brandConfig.brandName}.

BRAND VOICE:
${JSON.stringify(input.brandConfig.voiceTone, null, 2)}

FAQ KNOWLEDGE BASE:
${JSON.stringify(input.brandConfig.faqKnowledge, null, 2)}

THINGS TO NEVER DO OR SAY:
${input.brandConfig.doNots.map(d => `- ${d}`).join("\n")}

RULES:
1. Respond as the brand — warm, helpful, authentic to the voice.
2. Never make promises about refunds, replacements, or policy without FAQ backing.
3. For complaints or negative sentiment: empathize, offer to help, direct to DM/support if needed.
4. For questions not in the FAQ: acknowledge, say you'll look into it (escalate).
5. Keep replies concise — social media replies should be short and genuine.
6. NOT every comment needs a reply. Simple emoji reactions, spam, or trolling can be skipped.
7. NEVER engage with harassment or trolling. Flag for escalation.
8. Rate confidence 0-1. Below 0.7 means escalate to human.

Respond with a JSON object matching the required schema.`;

    const userMessage = `${input.engagementType} on ${input.platform}:
Author: ${input.authorName}
Message: "${input.body}"
${input.contentContext ? `\nOriginal post context: ${input.contentContext}` : ""}
${input.conversationHistory?.length ? `\nConversation history:\n${input.conversationHistory.map(m => `${m.author}: ${m.body}`).join("\n")}` : ""}

Craft an appropriate response (or decide not to respond).`;

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response");

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = EngagementResponseSchema.parse(JSON.parse(jsonMatch[0]));
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const shouldEscalate = parsed.confidenceScore < 0.7 || parsed.sentiment === "URGENT";

    return {
      success: true,
      data: parsed,
      confidenceScore: parsed.confidenceScore,
      shouldEscalate,
      escalationReason: shouldEscalate
        ? `${parsed.sentiment === "URGENT" ? "URGENT: " : ""}${parsed.reasoning}`
        : undefined,
      tokensUsed,
    };
  }
}
```

### 6.4 Confidence Scoring & Auto-Publish Logic

```typescript
// agents/shared/confidence.ts

export interface ConfidenceThresholds {
  autoPublish: number;    // Above this: publish without review
  flagForReview: number;  // Above this but below autoPublish: publish but flag
  requireReview: number;  // Above this but below flag: queue for review
  // Below requireReview: escalate
}

// Default thresholds — conservative for new clients, widen over time
export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoPublish: 0.90,
  flagForReview: 0.75,
  requireReview: 0.50,
};

// After 30 days of good performance, thresholds can relax
export const MATURE_THRESHOLDS: ConfidenceThresholds = {
  autoPublish: 0.80,
  flagForReview: 0.65,
  requireReview: 0.40,
};

export function getContentAction(
  confidence: number,
  thresholds: ConfidenceThresholds
): "auto_publish" | "flag_and_publish" | "queue_for_review" | "escalate" {
  if (confidence >= thresholds.autoPublish) return "auto_publish";
  if (confidence >= thresholds.flagForReview) return "flag_and_publish";
  if (confidence >= thresholds.requireReview) return "queue_for_review";
  return "escalate";
}
```

---

## 7. Job Queue / Orchestration (Inngest)

```typescript
// inngest/client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "socialai" });

// inngest/functions/content-pipeline.ts
import { inngest } from "../client";
import { ContentCreatorAgent } from "@/agents/content-creator";
import { prisma } from "@/lib/prisma";
import { getContentAction, DEFAULT_THRESHOLDS } from "@/agents/shared/confidence";

export const contentPipeline = inngest.createFunction(
  { id: "content-pipeline", retries: 3 },
  { cron: "0 */6 * * *" }, // Run every 6 hours
  async ({ step }) => {
    // Step 1: Get all active organizations that need content
    const orgs = await step.run("get-active-orgs", async () => {
      return prisma.organization.findMany({
        where: {
          plan: { not: "STARTER" }, // Only paid plans
          brandConfig: { isNot: null },
        },
        include: {
          brandConfig: true,
          socialAccounts: { where: { isActive: true } },
          contentPlans: {
            where: { status: "ACTIVE" },
            orderBy: { periodStart: "desc" },
            take: 1,
          },
        },
      });
    });

    // Step 2: Generate content for each org
    for (const org of orgs) {
      if (!org.brandConfig || !org.socialAccounts.length) continue;

      for (const account of org.socialAccounts) {
        await step.run(`create-content-${org.id}-${account.platform}`, async () => {
          const agent = new ContentCreatorAgent();
          const result = await agent.run(org.id, {
            organizationId: org.id,
            platform: account.platform,
            brandConfig: {
              brandName: org.brandConfig!.brandName,
              voiceTone: org.brandConfig!.voiceTone,
              contentThemes: org.brandConfig!.contentThemes,
              doNots: org.brandConfig!.doNots,
              targetAudience: org.brandConfig!.targetAudience,
              hashtagStrategy: org.brandConfig!.hashtagStrategy,
            },
            contentPlanContext: org.contentPlans[0]?.strategy
              ? JSON.stringify(org.contentPlans[0].strategy)
              : undefined,
          });

          if (result.success && result.data) {
            const content = result.data as any;
            const action = getContentAction(result.confidenceScore, DEFAULT_THRESHOLDS);

            const status = {
              auto_publish: "APPROVED",
              flag_and_publish: "APPROVED",
              queue_for_review: "PENDING_REVIEW",
              escalate: "PENDING_REVIEW",
            }[action] as any;

            await prisma.content.create({
              data: {
                organizationId: org.id,
                socialAccountId: account.id,
                platform: account.platform,
                contentType: content.contentType,
                status,
                caption: content.caption,
                hashtags: content.hashtags,
                confidenceScore: result.confidenceScore,
                agentNotes: content.reasoning,
                contentPlanId: org.contentPlans[0]?.id,
              },
            });
          }
        });
      }
    }
  }
);

// inngest/functions/publish-scheduled.ts
export const publishScheduled = inngest.createFunction(
  { id: "publish-scheduled", retries: 3 },
  { cron: "*/5 * * * *" }, // Check every 5 minutes
  async ({ step }) => {
    const due = await step.run("get-due-schedules", async () => {
      return prisma.schedule.findMany({
        where: {
          status: "PENDING",
          scheduledFor: { lte: new Date() },
        },
        include: {
          content: true,
          socialAccount: true,
        },
        take: 50,
      });
    });

    for (const schedule of due) {
      await step.run(`publish-${schedule.id}`, async () => {
        // Update status
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { status: "PUBLISHING" },
        });

        try {
          // Call platform-specific publisher
          // const platformPostId = await publishToplatform(schedule.socialAccount, schedule.content);

          await prisma.$transaction([
            prisma.schedule.update({
              where: { id: schedule.id },
              data: { status: "PUBLISHED", publishedAt: new Date() },
            }),
            prisma.content.update({
              where: { id: schedule.contentId },
              data: { status: "PUBLISHED", publishedAt: new Date() },
            }),
          ]);
        } catch (error) {
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: {
              status: "FAILED",
              retryCount: { increment: 1 },
              lastError: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      });
    }
  }
);
```

---

## 8. Social Platform Integration Pattern

```typescript
// lib/social/types.ts
export interface SocialPlatformClient {
  publish(params: PublishParams): Promise<PublishResult>;
  getComments(postId: string): Promise<Comment[]>;
  replyToComment(commentId: string, text: string): Promise<void>;
  getAnalytics(dateRange: DateRange): Promise<PlatformAnalytics>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
}

export interface PublishParams {
  caption: string;
  mediaUrls?: string[];
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL";
  scheduledFor?: Date;
}

export interface PublishResult {
  platformPostId: string;
  url: string;
}

// lib/social/meta.ts
export class MetaClient implements SocialPlatformClient {
  private accessToken: string;
  private pageId: string;

  constructor(accessToken: string, pageId: string) {
    this.accessToken = accessToken;
    this.pageId = pageId;
  }

  async publish(params: PublishParams): Promise<PublishResult> {
    // Implementation using Meta Graph API
    // POST /{page-id}/feed for Facebook
    // POST /{ig-user-id}/media + POST /{ig-user-id}/media_publish for Instagram
    throw new Error("Implement with Meta Graph API");
  }

  async getComments(postId: string): Promise<Comment[]> {
    // GET /{post-id}/comments
    throw new Error("Implement");
  }

  // ... etc
}

// Factory
export function createSocialClient(platform: Platform, account: SocialAccount): SocialPlatformClient {
  switch (platform) {
    case "INSTAGRAM":
    case "FACEBOOK":
      return new MetaClient(account.accessToken, account.platformUserId);
    case "TIKTOK":
      return new TikTokClient(account.accessToken);
    case "TWITTER":
      return new TwitterClient(account.accessToken);
    case "LINKEDIN":
      return new LinkedInClient(account.accessToken);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

---

## 9. Dashboard UI Requirements

### 9.1 Design System

Use shadcn/ui components exclusively. The dashboard should feel clean, modern, and data-rich. Key pages:

**Dashboard Overview** (`/dashboard`):
- KPI cards: total posts this week, engagement rate, follower growth, pending reviews
- Activity feed: recent agent actions (content created, posts published, comments replied)
- Escalation alerts: banner for any CRITICAL or HIGH priority escalations

**Content Calendar** (`/dashboard/content`):
- Calendar view showing scheduled and published content
- Click to preview any piece of content
- Status badges (draft, pending review, scheduled, published, failed)
- Filter by platform, status, date range

**Review Queue** (`/dashboard/review`):
- List of content and engagement responses needing human approval
- One-click approve/reject with optional feedback
- Side-by-side: AI-generated content vs. brand guidelines
- Bulk approve for high-confidence batches

**Brand Voice Config** (`/dashboard/brand`):
- Multi-step form: tone descriptors, example posts, do-nots, FAQ knowledge base
- Live preview: "Here's how your AI would write a post" with regenerate button
- Import from existing social accounts (AI analyzes past posts)

**Analytics** (`/dashboard/analytics`):
- Platform-level metrics with charts (use Recharts)
- Content performance table: sortable by engagement, reach, clicks
- AI performance metrics: auto-publish rate, escalation rate, confidence distribution
- Cost tracking: AI spend per client per month

### 9.2 Realtime Updates

Use Supabase Realtime to push updates to the dashboard:

```typescript
// Subscribe to escalations for the org
const channel = supabase
  .channel("escalations")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "escalations",
      filter: `organization_id=eq.${orgId}`,
    },
    (payload) => {
      // Show toast notification
      // Update escalation count badge
    }
  )
  .subscribe();
```

---

## 10. Security Requirements

1. **Encrypt social tokens at rest** — use Supabase Vault or application-level encryption (AES-256-GCM) for `access_token` and `refresh_token` fields
2. **Never expose service role key** to the client — agents use server-side only
3. **Rate limit all API routes** — use `next-rate-limit` or Vercel's built-in
4. **Validate all inputs** with Zod schemas — never trust user input
5. **Content Safety** — run all AI-generated content through a safety classifier before publishing. Use Claude's built-in safety + a custom blocklist per brand
6. **Audit trail** — the `agent_logs` table is your compliance backbone. Never skip logging.
7. **GDPR** — implement data export and deletion endpoints from day one

---

## 11. Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Social Platforms
META_APP_ID=
META_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Job Queue
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Email
RESEND_API_KEY=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## 12. Development Priorities (Build Order)

Follow this exact sequence. Do not skip ahead.

### Sprint 1 (Week 1-2): Foundation
1. `npx create-next-app@latest socialai --typescript --tailwind --app --src-dir` (this installs Next.js 16 + Tailwind v4 by default)
2. Verify `package.json` has `next@16`, `react@19`, `tailwindcss@4` — if not, upgrade: `npm install next@latest react@latest react-dom@latest tailwindcss@latest`
3. Enable React Compiler in `next.config.ts`: `reactCompiler: true`
4. Rename `middleware.ts` to `proxy.ts` if the scaffolder created one, rename export to `proxy`
5. Set up Supabase project, configure auth
6. Install and configure Prisma, create schema, run migrations
7. Set up shadcn/ui: `npx shadcn@latest init`
8. Build auth flow: signup → email confirm → onboarding
9. Build dashboard layout shell with sidebar navigation
10. Deploy to Vercel (keep deploying continuously)

### Sprint 2 (Week 3-4): First Agent Loop
1. Implement `BaseAgent` class
2. Implement `ContentCreatorAgent` with Claude API
3. Build brand voice configuration page
4. Build content review queue page
5. Manual trigger: "Generate a post" → AI creates it → shows in review → approve → mark as scheduled

### Sprint 3 (Week 5-6): Publishing
1. Implement Meta Graph API OAuth flow (Instagram + Facebook)
2. Implement `MetaClient.publish()`
3. Set up Inngest, implement `publish-scheduled` function
4. End-to-end: AI creates content → auto-approved → scheduled → published to Instagram
5. Build content calendar view

### Sprint 4 (Week 7-8): Engagement & Analytics
1. Implement `EngagementAgent`
2. Build comment/DM monitoring (poll Meta API every 15 min)
3. Implement `AnalyticsAgent` — pull metrics, generate weekly report
4. Build analytics dashboard page
5. Add Stripe billing integration

### Sprint 5 (Week 9-10): More Platforms + Onboarding
1. Add TikTok, X, LinkedIn OAuth + publishing
2. Build automated onboarding flow (brand voice questionnaire → AI analysis → strategy generation)
3. Implement `StrategyAgent` for content plan generation
4. Build the public marketing/landing page

### Sprint 6 (Week 11-12): Polish & Pilot
1. Implement confidence thresholds + auto-publish logic
2. Build escalation system + notification emails
3. Add error handling, retry logic, monitoring
4. Onboard 5 pilot clients
5. Iterate based on feedback

---

## 13. Code Quality Standards

- **No `any` types** — use proper TypeScript throughout
- **Zod validation** on every API boundary (route handlers, agent outputs, webhook payloads)
- **Error boundaries** in React — never let the dashboard crash
- **Server Components by default** — only use `"use client"` when you need interactivity
- **Async Server Actions** for mutations — cleaner than API routes for dashboard CRUD
- **Prisma transactions** when updating multiple tables atomically
- **Never call Supabase client-side for writes** — all mutations go through Server Actions or API routes
- **Test agent outputs** — write integration tests that verify agent responses match Zod schemas
- **Git commits** — conventional commits (`feat:`, `fix:`, `chore:`) with clear messages
- **Next.js 16 specifics**:
  - Use `proxy.ts` not `middleware.ts` — export a `proxy` function, runs on Node.js runtime
  - Use `'use cache'` directive for caching — no more `revalidate` exports or `unstable_cache`
  - Turbopack is the default bundler — no `--turbopack` flag needed in scripts
  - React Compiler is available — enable with `reactCompiler: true` in `next.config.ts`
  - Use React 19.2 features: View Transitions, `useEffectEvent`, `Activity` component
- **Tailwind CSS v4 specifics**:
  - Config is CSS-first: use `@theme` in your CSS file, NOT `tailwind.config.ts`
  - Use `@import "tailwindcss"` in your main CSS file
  - New color syntax: `text-blue-500` works, custom colors defined in `@theme { --color-brand: #4A90D9; }`
  - No `@apply` in most cases — use utility classes directly

---

## 14. Key Architectural Decisions (Do Not Deviate)

1. **Supabase Auth only.** No Clerk, no NextAuth, no custom auth. Supabase handles everything.
2. **Multi-tenant via `organization_id`.** Every data table is scoped to an org. RLS enforces isolation.
3. **Agents use service role.** AI agents run server-side with `supabaseAdmin` (bypasses RLS). Dashboard uses anon key with RLS.
4. **Claude API with structured outputs.** All agent responses must be parseable JSON validated by Zod. Use `tool_use` or instruct JSON output in system prompt.
5. **Confidence scoring is non-negotiable.** Every agent output has a confidence score. The orchestrator uses this to decide auto-publish vs. review vs. escalate.
6. **Audit everything.** The `agent_logs` table records every agent action. This is your debugging, compliance, and cost-tracking backbone.
7. **Abstract social platforms.** Every platform interaction goes through the `SocialPlatformClient` interface. Adding a new platform should only require implementing the interface.
8. **Inngest for orchestration.** Cron jobs and event-driven workflows via Inngest. No raw `setInterval` or manual cron.
9. **ZERO hardcoded values. ZERO placeholders. Everything is dynamic via database + admin UI.**

---

### Rule 9 — No Hardcoding Policy (CRITICAL)

This is a first-class rule. NOTHING configurable lives in source code. If a value might ever need to change, it goes in the database and gets an admin UI.

**What must be in the database (not code):**

| What | Table | Admin UI Location |
|------|-------|-------------------|
| Confidence thresholds (auto-publish, review, escalate) | `org_settings` per org | Dashboard → Settings → Automation |
| Posting schedules and optimal times | `posting_schedules` per org per platform | Dashboard → Settings → Schedule |
| Platform content limits (char counts, hashtag limits, image sizes) | `platform_configs` (system-wide) | Super Admin → Platforms |
| AI model name, temperature, max tokens | `org_settings` per org | Dashboard → Settings → AI Config |
| System prompts and prompt templates | `prompt_templates` (versioned, per agent) | Super Admin → Prompt Editor |
| Email templates | `email_templates` | Super Admin → Emails |
| Pricing tiers and feature limits | `plans` table | Super Admin → Plans |
| Rate limits and retry config per platform | `platform_configs` JSON fields | Super Admin → Platforms |
| Feature flags | `feature_flags` | Super Admin → Feature Flags |
| Onboarding questions and defaults | `onboarding_configs` | Super Admin → Onboarding |
| Escalation rules and trigger keywords | `escalation_rules` per org | Dashboard → Settings → Escalation |
| Content safety word lists (blocked, crisis, spam) | `safety_configs` | Super Admin → Safety |
| Platform-specific posting guidelines | `platform_configs` guidelines field | Super Admin → Platforms |

**How agents consume config:**

```typescript
// ❌ WRONG — hardcoded threshold
const AUTO_PUBLISH_THRESHOLD = 0.90;

// ✅ RIGHT — fetched from DB with fallback
const settings = await prisma.orgSettings.findUnique({
  where: { organizationId },
});
const threshold = settings?.autoPublishThreshold ?? 0.90;
```

```typescript
// ❌ WRONG — hardcoded prompt
const systemPrompt = `You are a social media expert...`;

// ✅ RIGHT — versioned template from DB
const template = await prisma.promptTemplate.findFirst({
  where: { agentName: "CONTENT_CREATOR", isActive: true },
  orderBy: { version: "desc" },
});
const systemPrompt = interpolateTemplate(template!.body, variables);
```

```typescript
// ❌ WRONG — hardcoded Instagram limits
const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;

// ✅ RIGHT — from platform_configs
const config = await prisma.platformConfig.findUnique({
  where: { platform: "INSTAGRAM" },
});
const maxCaption = config!.maxCaptionLength;
const maxHashtags = config!.maxHashtags;
```

**Fallback strategy:** Every config has a sensible default defined in a `prisma/seed.ts` file. If a DB value is null, the seed default is used. But the seed itself is the only place defaults live — never inline in application code.

**Admin access levels:**
- **Super Admin** (`/admin/*` routes): System-wide configs — platform limits, prompt templates, plans, feature flags, safety rules. Only platform operators.
- **Org Admin** (`/dashboard/settings/*` routes): Per-org configs — confidence thresholds, posting schedules, AI params, escalation rules, brand config.

**Additional Prisma Schema (add these tables alongside the existing schema):**

```prisma
model OrgSettings {
  id                          String   @id @default(uuid())
  organizationId              String   @unique
  organization                Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Confidence thresholds
  autoPublishThreshold        Float    @default(0.90)
  flagForReviewThreshold      Float    @default(0.75)
  requireReviewThreshold      Float    @default(0.50)

  // AI configuration
  defaultAiModel              String   @default("claude-sonnet-4-20250514")
  aiTemperature               Float    @default(0.7)
  aiMaxTokens                 Int      @default(4096)

  // Engagement automation
  autoEngagementEnabled       Boolean  @default(false)
  engagementConfidenceMin     Float    @default(0.85)
  engagementResponseDelaySec  Int      @default(300) // 5 min delay to seem human

  // Content limits
  maxPostsPerDayPerPlatform   Int      @default(3)
  contentBufferDays           Int      @default(2) // keep N days of content queued

  // General
  timezone                    String   @default("UTC")
  weeklyReportEnabled         Boolean  @default(true)
  weeklyReportDay             Int      @default(1) // 1=Monday

  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
}

model PlatformConfig {
  id                    String   @id @default(uuid())
  platform              Platform @unique
  displayName           String
  maxCaptionLength      Int
  maxHashtags           Int
  supportedContentTypes String[] // ["POST", "STORY", "REEL", "CAROUSEL", ...]
  imageSpecs            Json     // { feed: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 } }
  rateLimit             Json     // { postsPerDay: 25, requestsPerHour: 200 }
  retryConfig           Json     // { maxRetries: 3, backoffMs: [60000, 300000, 900000] }
  oauthScopes           String[]
  guidelines            String   @db.Text // Platform-specific posting guidelines for Content Creator
  isEnabled             Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model PromptTemplate {
  id          String    @id @default(uuid())
  agentName   AgentName
  name        String    // "content_creator_main", "engagement_dm_reply"
  description String?
  body        String    @db.Text
  variables   String[]  // ["brandName", "platform", "voiceTone"]
  version     Int       @default(1)
  isActive    Boolean   @default(true)
  createdBy   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([agentName, name, version])
}

model PostingSchedule {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  platform        Platform
  dayOfWeek       Int      // 0=Sun ... 6=Sat
  timeUtc         String   // "14:00"
  isEnabled       Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, platform, dayOfWeek, timeUtc])
}

model FeatureFlag {
  id          String   @id @default(uuid())
  key         String   @unique // "auto_engagement", "ab_testing", "trend_scout"
  name        String
  description String?
  isEnabled   Boolean  @default(false)
  planMinimum Plan?    // null = available on all plans
  metadata    Json?    // Extra config per flag
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model EscalationRule {
  id              String        @id @default(uuid())
  organizationId  String?       // null = global system rule
  organization    Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name            String
  triggerType     String        // "keyword", "sentiment", "follower_count", "repeat_complaint"
  triggerValue    String        // The keyword, threshold, or count
  action          String        // "escalate_critical", "escalate_high", "skip", "auto_dm"
  priority        EscalationPriority @default(MEDIUM)
  isEnabled       Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model EmailTemplate {
  id        String   @id @default(uuid())
  slug      String   @unique // "weekly_report", "escalation_alert", "welcome_email"
  subject   String
  body      String   @db.Text // HTML with {{variable}} placeholders
  variables String[]
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SafetyConfig {
  id        String   @id @default(uuid())
  category  String   @unique // "blocked_words", "crisis_keywords", "spam_patterns", "competitor_names"
  values    String[] // The actual word/pattern list
  action    String   // "block_publish", "escalate_critical", "flag_for_review", "skip"
  isEnabled Boolean  @default(true)
  updatedAt DateTime @updatedAt
}
```

**Seed file (`prisma/seed.ts`) must populate:**
- All `PlatformConfig` rows with real limits for Instagram, Facebook, TikTok, Twitter, LinkedIn
- Default `PromptTemplate` rows for every agent (version 1)
- Default `SafetyConfig` rows with crisis keywords, blocked words
- Default `FeatureFlag` rows for all features
- Default `EscalationRule` rows for system-wide rules (legal keywords, safety keywords)
- Default `EmailTemplate` rows for all notification types
