# SocialAI — Claude Code Instructions

This file mirrors AGENTS.md for Claude Code compatibility.
Read AGENTS.md for the full project instructions.

CRITICAL: Read these files before ANY implementation:
@CODING-INSTRUCTIONS.md — Full tech stack, database schema, agent patterns, build order
@AGENTS.md — Project rules, sprint plan, current status

## Skills Directory

Read the relevant skill from `.claude/skills/` before implementing any feature:

**⚡ READ FIRST — Defines the entire UX:**
- `.claude/skills/ai-first-ux/SKILL.md` — THE master UX skill. AI-guided onboarding + mission control dashboard. No menus. No settings pages. AI runs everything. Human monitors. **This overrides all UI assumptions in every other skill.**

**Core Agents:**
- `.claude/skills/base-agent/SKILL.md` — READ FIRST for any agent work
- `.claude/skills/content-creator/SKILL.md` — Content generation agent
- `.claude/skills/engagement/SKILL.md` — Comment/DM response agent
- `.claude/skills/publisher/SKILL.md` — Publishing agent
- `.claude/skills/analytics/SKILL.md` — Analytics & reporting agent
- `.claude/skills/strategy/SKILL.md` — Strategy planning agent
- `.claude/skills/trend-scout/SKILL.md` — Trend detection agent
- `.claude/skills/visual/SKILL.md` — Image/video generation agent
- `.claude/skills/ab-testing/SKILL.md` — Experiment agent
- `.claude/skills/orchestrator/SKILL.md` — System coordination
- `.claude/skills/social-platform/SKILL.md` — Platform API abstraction

**Intelligence Agents:**
- `.claude/skills/competitor-intelligence/SKILL.md` — Competitor monitoring & gap analysis
- `.claude/skills/social-listening/SKILL.md` — Brand monitoring across the social web
- `.claude/skills/audience-intelligence/SKILL.md` — Dynamic audience personas & insights
- `.claude/skills/influencer-scout/SKILL.md` — Influencer discovery & scoring
- `.claude/skills/onboarding-intelligence/SKILL.md` — New client account analysis & strategy
- `.claude/skills/churn-prediction/SKILL.md` — Client health monitoring & retention

**Multiplier Agents:**
- `.claude/skills/repurpose/SKILL.md` — Cross-platform content multiplication
- `.claude/skills/localization/SKILL.md` — Multi-market cultural adaptation
- `.claude/skills/caption-rewriter/SKILL.md` — Rewrite underperforming content
- `.claude/skills/ad-copy/SKILL.md` — Organic-to-paid ad creative generation

**Optimization Agents:**
- `.claude/skills/hashtag-optimizer/SKILL.md` — Data-driven hashtag strategy
- `.claude/skills/calendar-optimizer/SKILL.md` — Full calendar balancing & timing

**Reliability & Safety Agents:**
- `.claude/skills/content-replenishment/SKILL.md` — Pipeline monitoring, never go dark
- `.claude/skills/compliance/SKILL.md` — Regulatory & brand safety pre-publish gate
- `.claude/skills/crisis-response/SKILL.md` — Crisis detection, pause, brief & response

**Client-Facing Agents:**
- `.claude/skills/ugc-curator/SKILL.md` — User-generated content discovery & permission
- `.claude/skills/review-response/SKILL.md` — Google/Yelp/Facebook review responses
- `.claude/skills/reporting-narrator/SKILL.md` — Client-ready narrative performance reports

**Revenue & Attribution Agents:**
- `.claude/skills/roi-attribution/SKILL.md` — Social → revenue attribution with GA4/Shopify/CRM
- `.claude/skills/cross-channel-attribution/SKILL.md` — Multi-touch customer journey mapping
- `.claude/skills/pricing-intelligence/SKILL.md` — Competitor pricing & promotion monitoring

**Advanced Intelligence Agents:**
- `.claude/skills/predictive-content/SKILL.md` — Pre-publish performance prediction
- `.claude/skills/brand-voice-guardian/SKILL.md` — Voice consistency scoring & drift detection
- `.claude/skills/social-seo/SKILL.md` — Social platform search optimization
- `.claude/skills/sentiment-intelligence/SKILL.md` — Deep brand perception modeling
- `.claude/skills/competitive-ad-intelligence/SKILL.md` — Competitor paid ad monitoring

**Growth Agents:**
- `.claude/skills/community-builder/SKILL.md` — Super fan nurturing & community rituals
- `.claude/skills/media-pitch/SKILL.md` — Earned media opportunity detection & PR pitches

**Platform Features:**
- `.claude/skills/client-viewer-dashboard/SKILL.md` — Read-only branded dashboard for client stakeholders
- `.claude/skills/ai-training-mode/SKILL.md` — Per-org AI learning from feedback, corrections, preferences
- `.claude/skills/multi-language-dashboard/SKILL.md` — Full i18n: 10 languages, RTL support, DB overrides

**Intelligence Systems (READ THESE — they make every agent smarter):**
- `.claude/skills/shared-memory/SKILL.md` — pgvector memory layer: every agent recalls before executing, stores after. The collective brain.
- `.claude/skills/self-evaluation/SKILL.md` — Post-mortem on every published post: predicted vs actual. Feeds learnings back to all agents.
- `.claude/skills/content-dna/SKILL.md` — Fingerprints winning content DNA. New content is engineered to match proven formulas.
- `.claude/skills/goal-tracking/SKILL.md` — Tracks progress toward client goals. Auto-adjusts strategy when falling behind.
- `.claude/skills/inter-client-learning/SKILL.md` — Anonymized cross-client patterns. Network effect — platform gets smarter with every client.

**Billing & Infrastructure:**
- `.claude/skills/billing/SKILL.md` — Complete Stripe integration: multi-currency, plan management from admin UI, entitlements, dunning, webhooks. Controls which agents each plan can use via Orchestrator.

All rules from AGENTS.md apply here. The user never runs terminal commands.
