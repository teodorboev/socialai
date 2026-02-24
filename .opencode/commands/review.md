---
description: "Run a code review on recent changes"
agent: review
subtask: true
---

Review the recent changes in the SocialAI codebase.

Check `git diff main` or `git diff HEAD~$ARGUMENTS` (default: 5 commits) and review against the project standards defined in @AGENTS.md.

Focus on:
- TypeScript strictness (no `any`)
- Zod validation on boundaries
- Agent pattern compliance (BaseAgent, confidence scores, logging)
- Security (no exposed secrets, RLS, input validation)
- Supabase Auth only (no other auth libraries)
- Code quality and maintainability
