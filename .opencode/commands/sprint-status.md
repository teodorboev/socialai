---
description: "Report current sprint progress and next steps"
agent: plan
---

Check the current state of the SocialAI project:

1. Read @AGENTS.md for the expected sprint plan and current status
2. Read @CODING-INSTRUCTIONS.md Section 12 for the full build order
3. Check what exists:
   - `prisma/schema.prisma` — is the schema set up?
   - `agents/` — which agents are implemented?
   - `inngest/functions/` — which scheduled jobs exist?
   - `app/(dashboard)/` — which dashboard pages exist?
   - `lib/social/` — which platform integrations exist?
   - `lib/supabase/` — is auth configured?
4. Check recent git history: `git log --oneline -20`

Report:
- Current sprint number and name
- What's been completed
- What's remaining in the current sprint
- Any blockers or issues detected
- Recommended next task
