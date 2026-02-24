---
description: "Pre-deploy checks and deploy to Vercel"
agent: build
---

Run pre-deploy checks and deploy:

1. Run type check: `npx tsc --noEmit`
2. Run linter: `npm run lint`
3. Run build: `npm run build`
4. If all pass:
   - Commit any uncommitted changes
   - Push current branch to remote
   - If on a feature branch, report that it's ready for merge
   - If on main, trigger Vercel deploy: `npx vercel --prod`
5. If any check fails:
   - Fix the issues
   - Re-run checks
   - Then deploy

Report deploy status and any issues found.
