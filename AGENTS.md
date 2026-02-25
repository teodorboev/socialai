# SocialAI — AI-Native Social Media Management Platform

You are the lead developer building a fully AI-automated social media management platform for B2C brands and small businesses. AI agents handle the entire content lifecycle autonomously. Humans only handle executive decisions and finance.

## Critical References — Read Before ANY Code

CRITICAL: When you encounter a file reference (e.g., @CODING-INSTRUCTIONS.md), use your Read tool to load it. These files contain exact schemas, patterns, and implementation details.

Read the following file immediately as it's relevant to all workflows:
@CODING-INSTRUCTIONS.md

## Available Skills

Skills contain agent-specific architecture, schemas, prompts, and checklists. Read the relevant skill BEFORE implementing any agent.

| When building... | Read these skills (in order) |
|-----------------|------------------------------|
| Any new AI agent | `base-agent` → `[specific agent]` |
| Content generation pipeline | `base-agent` → `content-creator` → `hashtag-optimizer` → `visual` → `compliance` → `publisher` |
| Comment/DM auto-responses | `base-agent` → `engagement` |
| Monthly content planning | `base-agent` → `strategy` → `analytics` → `audience-intelligence` |
| Trend monitoring | `base-agent` → `trend-scout` → `content-creator` |
| Performance reporting | `base-agent` → `analytics` → `reporting-narrator` |
| Content experiments | `base-agent` → `ab-testing` → `analytics` |
| Publishing to any platform | `social-platform` → `compliance` → `publisher` |
| Connecting a new social account | `social-platform` → `onboarding-intelligence` |
| Image/video generation | `visual` |
| Scheduled jobs / cron functions | `orchestrator` |
| The overall system coordination | `orchestrator` → `content-replenishment` |
| Competitor monitoring | `base-agent` → `competitor-intelligence` |
| Content repurposing / multiplication | `base-agent` → `repurpose` → `content-creator` |
| Brand monitoring / social listening | `base-agent` → `social-listening` → `crisis-response` |
| Audience personas / insights | `base-agent` → `audience-intelligence` → `analytics` |
| Influencer discovery | `base-agent` → `influencer-scout` |
| Pipeline reliability / never go dark | `content-replenishment` → `orchestrator` |
| Regulatory / brand compliance | `base-agent` → `compliance` |
| Multi-market / multi-language content | `base-agent` → `localization` → `compliance` → `visual` |
| Hashtag strategy | `base-agent` → `hashtag-optimizer` → `content-creator` |
| Rewriting underperformers | `base-agent` → `caption-rewriter` → `analytics` |
| Crisis management | `base-agent` → `crisis-response` → `social-listening` → `engagement` |
| User-generated content pipeline | `base-agent` → `ugc-curator` → `engagement` → `compliance` |
| Review management (Google, Yelp, etc.) | `base-agent` → `review-response` |
| Paid social ad creation | `base-agent` → `ad-copy` → `audience-intelligence` → `compliance` |
| Calendar optimization | `base-agent` → `calendar-optimizer` → `audience-intelligence` |
| Client-ready reports (narrative) | `base-agent` → `reporting-narrator` → `analytics` |
| New client onboarding | `base-agent` → `onboarding-intelligence` → `strategy` |
| Client retention / churn prevention | `churn-prediction` → `reporting-narrator` |
| Revenue attribution (is social making money?) | `base-agent` → `roi-attribution` → `analytics` |
| Content performance prediction | `base-agent` → `predictive-content` → `analytics` |
| Brand voice consistency | `base-agent` → `brand-voice-guardian` |
| Social search optimization | `base-agent` → `social-seo` → `hashtag-optimizer` |
| Deep brand perception / sentiment | `base-agent` → `sentiment-intelligence` → `social-listening` |
| Multi-touch customer journey | `base-agent` → `cross-channel-attribution` → `roi-attribution` |
| Competitor pricing / promotions | `base-agent` → `pricing-intelligence` → `competitor-intelligence` |
| Community management & super fans | `base-agent` → `community-builder` → `ugc-curator` |
| PR / earned media from social traction | `base-agent` → `media-pitch` → `social-listening` |
| Competitor paid ad monitoring | `base-agent` → `competitive-ad-intelligence` → `ad-copy` |

## Tech Stack (Non-Negotiable)

- **Framework**: Next.js 16 (App Router), TypeScript strict, Turbopack default, React 19.2
- **Styling**: Tailwind CSS v4 + shadcn/ui (CSS-first config with `@theme`, no `tailwind.config.ts`)
- **Database**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **ORM**: Prisma (schema-first, all changes via migrations)
- **Auth**: Supabase Auth exclusively — NO Clerk, NO NextAuth
- **AI/LLM**: Anthropic Claude API (primary), structured outputs with Zod validation
- **Job Queue**: Inngest for all orchestration
- **Payments**: Stripe
- **Hosting**: Vercel (frontend) + Railway or Fly.io (workers)

## Architectural Rules (Do Not Deviate)

1. **Supabase Auth only.** No Clerk, no NextAuth, no custom auth.
2. **Multi-tenant via `organization_id`.** Every data table scoped to an org. RLS enforces isolation.
3. **Agents use service role.** AI agents run server-side with `supabaseAdmin` (bypasses RLS). Dashboard uses anon key with RLS.
4. **Claude API with structured outputs.** All agent responses must be parseable JSON validated by Zod.
5. **Every agent extends BaseAgent.** No standalone LLM-calling functions.
6. **Confidence scoring is non-negotiable.** Every agent output has a confidence score driving auto-publish vs review vs escalate.
7. **Audit everything.** `agent_logs` table records every agent action. Never skip logging.
8. **Abstract social platforms.** Every platform interaction goes through `SocialPlatformClient` interface.
9. **Inngest for orchestration.** No raw setInterval, no manual cron.
10. **ZERO hardcoded values. ZERO placeholders. Everything is dynamic.**
    - No hardcoded strings, URLs, thresholds, templates, prompts, schedules, or configuration of any kind in source code.
    - ALL configurable values must be stored in the database and editable through the admin dashboard.
    - This includes but is not limited to:
      - Confidence thresholds (auto-publish, review, escalate) → stored per-org in DB, editable in dashboard
      - Posting schedules and optimal times → stored per-org per-platform, editable in dashboard
      - Platform-specific content limits (character counts, hashtag limits) → stored in a `platform_config` table
      - AI model selection and parameters (model name, temperature, max tokens) → stored in an `ai_config` table
      - System prompts and prompt templates → stored in DB, editable through admin prompt editor
      - Pricing tiers and feature limits → stored in DB, manageable through admin
      - Email templates → stored in DB, editable through admin
      - Rate limits and retry configuration → stored in DB
      - Brand voice defaults and onboarding questions → stored in DB
      - Feature flags → stored in DB, toggleable through admin
    - If you catch yourself writing a magic number, a string literal for configuration, or a hardcoded list — STOP. Create a DB table or column for it and build an admin UI to manage it.
    - The ONLY exceptions are: environment variables (secrets/keys), package imports, and TypeScript type definitions.

## Code Standards

- **No `any` types.** Use proper TypeScript throughout.
- **Zod validation** on every API boundary.
- **Server Components by default.** `"use client"` only when needed.
- **Prisma transactions** when updating multiple tables atomically.
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `refactor:` on feature branches.
- **Never commit directly to main.**

## User Interaction Rules

- **The user never runs terminal commands.** You handle all migrations, installs, git operations, builds, and dev server.
- **The user only makes executive decisions and approves finances.**
- **Don't ask the user to run anything.** If you need a credential or env variable, ask for the value, not for them to execute a command.

## Build Order

Follow this sequence. Do not skip ahead.

### Sprint 1 (Weeks 1–2): Foundation
1. Initialize Next.js 16 project: `npx create-next-app@latest socialai --typescript --tailwind --app --src-dir`
2. Verify versions: `next@16`, `react@19`, `tailwindcss@4` — upgrade if needed
3. Enable React Compiler in `next.config.ts`, rename `middleware.ts` → `proxy.ts`
4. Set up Supabase project, configure auth
5. Install Prisma, create schema from CODING-INSTRUCTIONS.md, run migrations
6. Set up shadcn/ui
7. Build auth flow (signup → email confirm → dashboard redirect)
8. Build dashboard layout shell with sidebar
9. Deploy to Vercel

### Sprint 2 (Weeks 3–4): First Agent Loop
1. Implement BaseAgent class (read `base-agent` skill)
2. Implement ContentCreatorAgent (read `content-creator` skill)
3. Build brand voice configuration page
4. Build content review queue page
5. Manual trigger: generate post → review → approve → schedule

### Sprint 3 (Weeks 5–6): Publishing
1. Implement Meta Graph API OAuth (read `social-platform` skill)
2. Implement MetaClient.publish() (read `publisher` skill)
3. Set up Inngest, implement publish-scheduled function
4. End-to-end: AI creates → auto-approved → scheduled → published
5. Build content calendar view

### Sprint 4 (Weeks 7–8): Engagement & Analytics
1. Implement EngagementAgent (read `engagement` skill)
2. Build comment/DM monitoring
3. Implement AnalyticsAgent (read `analytics` skill)
4. Build analytics dashboard
5. Add Stripe billing

### Sprint 5 (Weeks 9–10): More Platforms + Onboarding
1. Add TikTok, X, LinkedIn OAuth + publishing
2. Build automated onboarding flow
3. Implement StrategyAgent (read `strategy` skill)
4. Build public landing page

### Sprint 6 (Weeks 11–12): Polish & Pilot
1. Implement confidence thresholds + auto-publish logic
2. Build escalation system + notification emails
3. Add monitoring and error handling
4. Onboard 5 pilot clients

## Response Format

When completing a task:
1. State what you built
2. State the branch and commit(s)
3. List what to test
4. State the next task in the sprint

## Current Status

- **Sprint**: 1 (Foundation)
- **Last completed**: Fresh start
- **Current branch**: main
- **Next task**: Initialize project and set up infrastructure
