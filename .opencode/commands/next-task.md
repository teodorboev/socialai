---
description: "Start the next task in the current sprint"
agent: build
---

Continue building the SocialAI platform:

1. Read @AGENTS.md to check the current sprint and status
2. Read @CODING-INSTRUCTIONS.md for implementation details
3. Identify the next uncompleted task in the current sprint
4. Read the relevant skill(s) from .opencode/skills/
5. Create a feature branch: `git checkout -b feat/<task-description>`
6. Implement the task fully — production-grade code, no placeholders
7. Test that it works
8. Commit with a conventional commit message
9. Update the "Current Status" section in AGENTS.md
10. Report what was built and what's next

If $ARGUMENTS is provided, work on that specific task instead of the next in sequence.
