---
description: "Scaffold a new AI agent with all required files"
agent: build
---

Create a new agent called "$ARGUMENTS" for the SocialAI platform.

Before starting:
1. Read the skill @.opencode/skills/base-agent/SKILL.md
2. Check if a skill exists at @.opencode/skills/$ARGUMENTS/SKILL.md and read it if so

Then create all required files following the base-agent checklist:
1. `agents/$ARGUMENTS.ts` — Agent class extending BaseAgent
2. `lib/ai/schemas/$ARGUMENTS.ts` — Zod output schema
3. `lib/ai/prompts/$ARGUMENTS.ts` — System prompt template
4. `inngest/functions/$ARGUMENTS.ts` — Inngest trigger function
5. Add the AgentName enum value to `prisma/schema.prisma` if not present
6. Run `npx prisma migrate dev --name add_$ARGUMENTS_agent`
7. Run `npx prisma generate`

Commit with: `feat: scaffold $ARGUMENTS agent`
