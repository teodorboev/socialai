---
name: content-replenishment
description: "Monitors the content pipeline and proactively fills gaps. Ensures no client ever goes dark. Triggers Content Creator when schedule is thin. Handles failed publish recovery. The 'never go silent' guarantee."
---

# SKILL: Content Replenishment Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

The reliability backbone. Monitors every client's content pipeline and ensures they always have enough content scheduled. If the queue runs thin, it triggers Content Creator. If a publish fails, it creates a replacement. If a client hasn't posted in too long, it escalates. This agent is why managed service clients trust the platform.

**This agent does NOT use an LLM.** It's pure orchestration logic — checking counts, comparing thresholds, and triggering other agents.

---

## File Location

```
agents/content-replenishment.ts
inngest/functions/content-replenishment.ts
```

---

## Logic

```typescript
interface ReplenishmentCheck {
  organizationId: string;
  settings: {
    contentBufferDays: number;      // From org_settings — how many days ahead to keep filled
    maxPostsPerDayPerPlatform: number;
    platforms: Platform[];
    alertAfterSilentHours: number;  // Escalate if no post for this many hours
  };
}

interface ReplenishmentResult {
  orgId: string;
  status: "healthy" | "low" | "critical" | "silent";
  scheduledNext48h: number;
  targetNext48h: number;
  deficit: number;
  lastPublishedAt: Date | null;
  hoursSinceLastPost: number;
  actions: ReplenishmentAction[];
}

type ReplenishmentAction =
  | { type: "trigger_content_creator"; platform: Platform; count: number }
  | { type: "escalate_silent"; hoursSilent: number }
  | { type: "retry_failed_publish"; scheduleId: string }
  | { type: "notify_low_queue"; deficit: number }
  | { type: "none"; reason: string };
```

---

## Decision Tree

```
For each active org + platform:

1. Count scheduled content for next N days (N = contentBufferDays)
2. Calculate target: maxPostsPerDayPerPlatform × contentBufferDays
3. Calculate deficit = target - scheduled

┌─────────────────────────────────┐
│ deficit <= 0?                   │
│ YES → Status: HEALTHY           │──→ No action
│ NO  ↓                           │
├─────────────────────────────────┤
│ deficit < target × 0.5?        │
│ YES → Status: LOW               │──→ Trigger Content Creator for (deficit) posts
│ NO  ↓                           │──→ + Notify dashboard
├─────────────────────────────────┤
│ deficit >= target × 0.5?       │
│ YES → Status: CRITICAL          │──→ Trigger Content Creator (HIGH priority)
│                                 │──→ + Notify dashboard
│                                 │──→ + Email org admin
└─────────────────────────────────┘

Separately:
┌─────────────────────────────────┐
│ Hours since last post >         │
│ alertAfterSilentHours?          │
│ YES → Status: SILENT            │──→ Escalate to human as HIGH
│                                 │──→ + Trigger Content Creator immediately
│                                 │──→ + Email org admin
└─────────────────────────────────┘

Also check:
┌─────────────────────────────────┐
│ Any schedules with status       │
│ FAILED in last 24h?             │
│ YES → For each:                 │──→ If retryable: re-trigger Publisher
│                                 │──→ If not retryable: create replacement content
│                                 │──→ + Escalate as MEDIUM
└─────────────────────────────────┘
```

---

## Implementation

```typescript
export class ContentReplenishmentAgent extends BaseAgent {
  constructor() {
    super("CONTENT_REPLENISHMENT");
  }

  async execute(input: ReplenishmentCheck): Promise<AgentResult<ReplenishmentResult>> {
    const actions: ReplenishmentAction[] = [];
    let status: ReplenishmentResult["status"] = "healthy";

    for (const platform of input.settings.platforms) {
      // Count scheduled content
      const scheduledCount = await prisma.schedule.count({
        where: {
          organizationId: input.organizationId,
          platform,
          status: "PENDING",
          scheduledFor: {
            gte: new Date(),
            lte: addDays(new Date(), input.settings.contentBufferDays),
          },
        },
      });

      const target = input.settings.maxPostsPerDayPerPlatform * input.settings.contentBufferDays;
      const deficit = target - scheduledCount;

      if (deficit > 0) {
        status = deficit >= target * 0.5 ? "critical" : "low";
        actions.push({
          type: "trigger_content_creator",
          platform,
          count: deficit,
        });
      }
    }

    // Check silence
    const lastPublished = await prisma.schedule.findFirst({
      where: { organizationId: input.organizationId, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    });

    const hoursSilent = lastPublished?.publishedAt
      ? differenceInHours(new Date(), lastPublished.publishedAt)
      : Infinity;

    if (hoursSilent > input.settings.alertAfterSilentHours) {
      status = "silent";
      actions.push({ type: "escalate_silent", hoursSilent });
    }

    // Check failed publishes
    const failedSchedules = await prisma.schedule.findMany({
      where: {
        organizationId: input.organizationId,
        status: "FAILED",
        updatedAt: { gte: subHours(new Date(), 24) },
      },
    });

    for (const failed of failedSchedules) {
      actions.push({ type: "retry_failed_publish", scheduleId: failed.id });
    }

    return {
      success: true,
      data: {
        orgId: input.organizationId,
        status,
        scheduledNext48h: 0, // calculated above per-platform
        targetNext48h: 0,
        deficit: 0,
        lastPublishedAt: lastPublished?.publishedAt ?? null,
        hoursSinceLastPost: hoursSilent,
        actions,
      },
      confidenceScore: 1, // Deterministic — no LLM
      shouldEscalate: status === "silent" || status === "critical",
      escalationReason: status === "silent"
        ? `No posts published in ${hoursSilent} hours`
        : status === "critical"
        ? "Content queue critically low"
        : undefined,
      tokensUsed: 0,
    };
  }
}
```

---

## Schedule

```typescript
export const contentReplenishment = inngest.createFunction(
  { id: "content-replenishment", retries: 1 },
  { cron: "0 */2 * * *" },  // Every 2 hours
  async ({ step }) => {
    const orgs = await step.run("get-active-orgs", /* ... */);

    for (const org of orgs) {
      const result = await step.run(`check-${org.id}`, async () => {
        const agent = new ContentReplenishmentAgent();
        return agent.run(org.id, { organizationId: org.id, settings: org.settings });
      });

      // Execute actions
      for (const action of result.data.actions) {
        await step.run(`action-${org.id}-${action.type}`, async () => {
          switch (action.type) {
            case "trigger_content_creator":
              await inngest.send({ name: "content/generate-batch", data: { ... } });
              break;
            case "retry_failed_publish":
              await inngest.send({ name: "schedule/retry", data: { ... } });
              break;
            case "escalate_silent":
              // Escalation handled by BaseAgent
              break;
          }
        });
      }
    }
  }
);
```
