# SocialAI — Claude Code Instructions

This file mirrors AGENTS.md for Claude Code compatibility.
Read AGENTS.md for the full project instructions.

CRITICAL: Read these files before ANY implementation:
@CODING-INSTRUCTIONS.md — Full tech stack, database schema, agent patterns, build order
@AGENTS.md — Project rules, sprint plan, current status

## Skills Directory

Read the relevant skill from `.claude/skills/` before implementing any agent:

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

All rules from AGENTS.md apply here. The user never runs terminal commands.
