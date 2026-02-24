---
description: "Add support for a new social media platform"
agent: build
---

Add support for the "$ARGUMENTS" social media platform.

Before starting, read:
1. @.opencode/skills/social-platform/SKILL.md — Full integration pattern and checklist
2. @.opencode/skills/publisher/SKILL.md — Publishing and formatting requirements
3. @.opencode/skills/content-creator/SKILL.md — Platform guidelines section

Follow the "Adding a New Platform — Checklist" from the social-platform skill:
1. Create `lib/social/$ARGUMENTS.ts` implementing `SocialPlatformClient`
2. Add platform to `Platform` enum in Prisma schema, run migration
3. Add OAuth routes: `/api/social/$ARGUMENTS/authorize` + `/callback`
4. Add to factory in `lib/social/factory.ts`
5. Add platform guidelines to Content Creator prompt
6. Add platform dimensions to Visual Agent
7. Add to Publisher Agent formatting
8. Update Analytics Agent metrics mapping
9. Test end-to-end: connect → generate content → publish → fetch metrics

Commit with: `feat: add $ARGUMENTS platform integration`
