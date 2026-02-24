---
name: orchestrator
description: "System coordination: cron schedules for all agents, event-driven triggers, priority system, circuit breaker, health checks. No LLM calls."
---

# SKILL: Orchestrator Agent

> **Prerequisite**: Read `skills/base-agent/SKILL.md` first.

---

## Purpose

The central coordinator of all AI agents. Manages scheduling, priority, dependencies between agents, system health, and serves as the entry point for all automated workflows. Does NOT use an LLM for most operations — it's primarily a deterministic coordination layer.

---

## File Location

```
agents/orchestrator.ts
inngest/client.ts
inngest/functions/               ← All scheduled functions
```

---

## Architecture

The Orchestrator is NOT a single monolithic process. It's implemented as a collection of Inngest functions that coordinate agent execution:

```
Orchestrator
├── Content Pipeline      (cron: */4h)   → Strategy → Content Creator → Visual → Publisher
├── Engagement Monitor    (cron: */15m)  → Engagement Agent
├── Analytics Snapshot    (cron: */6h)   → Analytics Agent (data mode)
├── Weekly Report         (cron: Mon 9am)→ Analytics Agent (report mode)
├── Trend Scan            (cron: */4h)   → Trend Scout Agent
├── Monthly Strategy      (cron: 1st/mo) → Strategy Agent
├── A/B Test Design       (cron: 1st/mo) → A/B Testing Agent
├── A/B Test Evaluation   (cron: Mon)    → A/B Testing Agent
├── Token Refresh         (cron: daily)  → Check/refresh expiring OAuth tokens
├── Health Check          (cron: */1h)   → Verify all agents operational
└── Event-driven triggers
    ├── on: "content.approved"      → Schedule for publishing
    ├── on: "escalation.resolved"   → Apply resolution (publish, update, etc.)
    ├── on: "trend.urgent"          → Trigger immediate content creation
    └── on: "account.connected"     → Run initial historical analysis
```

---

## Implementation

```typescript
// agents/orchestrator.ts
// The orchestrator is NOT a BaseAgent subclass — it's a coordination layer.

export class Orchestrator {

  /** Determines which agents need to run for a given org right now. */
  async getAgentSchedule(organizationId: string): Promise<AgentTask[]> {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        brandConfig: true,
        socialAccounts: { where: { isActive: true } },
        contentPlans: { where: { status: "ACTIVE" }, take: 1 },
        schedules: { where: { status: "PENDING" } },
      },
    });

    const tasks: AgentTask[] = [];

    // Does this org need content generated?
    const scheduledNext48h = await this.getScheduledContentCount(organizationId, 48);
    const targetNext48h = this.getTargetContentCount(org);
    if (scheduledNext48h < targetNext48h) {
      tasks.push({
        agent: "CONTENT_CREATOR",
        priority: scheduledNext48h === 0 ? "HIGH" : "MEDIUM",
        reason: `Only ${scheduledNext48h}/${targetNext48h} posts scheduled for next 48h`,
      });
    }

    // Does this org need a new strategy?
    const activePlan = org.contentPlans[0];
    if (!activePlan || new Date(activePlan.periodEnd) < new Date()) {
      tasks.push({
        agent: "STRATEGY",
        priority: "HIGH",
        reason: "No active content plan",
      });
    }

    // Are there unprocessed engagements?
    const pendingEngagements = await prisma.engagement.count({
      where: { organizationId, aiResponseStatus: "PENDING" },
    });
    if (pendingEngagements > 0) {
      tasks.push({
        agent: "ENGAGEMENT",
        priority: pendingEngagements > 20 ? "HIGH" : "MEDIUM",
        reason: `${pendingEngagements} unprocessed engagements`,
      });
    }

    return tasks.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
  }

  /** System health check — verifies all components are operational. */
  async healthCheck(): Promise<HealthReport> {
    return {
      database: await this.checkDatabase(),
      agents: await this.checkRecentAgentActivity(),
      socialApis: await this.checkSocialApiStatus(),
      llmApi: await this.checkLlmApi(),
      queue: await this.checkQueueHealth(),
      lastRun: new Date().toISOString(),
    };
  }
}
```

---

## Event-Driven Triggers

Beyond cron schedules, the Orchestrator responds to events:

```typescript
// When content is manually approved in the review queue
export const onContentApproved = inngest.createFunction(
  { id: "on-content-approved" },
  { event: "content/approved" },
  async ({ event, step }) => {
    const { contentId, organizationId } = event.data;

    await step.run("schedule-content", async () => {
      // Determine optimal posting time
      // Create schedule record
      // If Visual Agent hasn't run yet, trigger it first
    });
  }
);

// When a high-urgency trend is detected
export const onUrgentTrend = inngest.createFunction(
  { id: "on-urgent-trend" },
  { event: "trend/urgent" },
  async ({ event, step }) => {
    // Trigger Content Creator immediately for relevant orgs
    // Fast-track through approval (if confidence > 0.85)
  }
);

// When a new social account is connected
export const onAccountConnected = inngest.createFunction(
  { id: "on-account-connected" },
  { event: "account/connected" },
  async ({ event, step }) => {
    // 1. Fetch historical posts (last 90 days)
    // 2. Run Analytics Agent to analyze performance patterns
    // 3. Feed into Strategy Agent for initial content plan
    // 4. Notify dashboard that onboarding analysis is complete
  }
);
```

---

## Priority System

```typescript
type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

function priorityOrder(p: Priority): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[p];
}

// CRITICAL: PR crisis, failed publish that needs retry, token about to expire
// HIGH: No content scheduled for tomorrow, unprocessed complaints
// MEDIUM: Regular content generation, trend scanning, analytics
// LOW: A/B test evaluation, playbook updates, non-urgent reports
```

---

## Circuit Breaker

If an agent fails repeatedly, the Orchestrator stops calling it and escalates:

```typescript
const CIRCUIT_BREAKER = {
  failureThreshold: 3,       // 3 consecutive failures
  cooldownMinutes: 30,       // Wait 30 min before retrying
  resetAfterSuccess: true,   // Single success resets the counter
};

// Track in Redis or Supabase:
// key: `circuit:${agentName}:${organizationId}`
// value: { failures: number, lastFailure: Date, isOpen: boolean }
```

---

## Monitoring Dashboard Data

The Orchestrator exposes these metrics for the admin dashboard:

```typescript
interface OrchestratorMetrics {
  activeOrganizations: number;
  agentsRunLast24h: Record<AgentName, number>;
  averageLatencyMs: Record<AgentName, number>;
  escalationsOpen: number;
  failedJobs24h: number;
  totalTokensUsed24h: number;
  estimatedCost24h: number;
  contentPublished24h: number;
  engagementsProcessed24h: number;
  queueDepth: number;
}
```

---

## Rules

1. **The Orchestrator never calls LLMs.** It's pure coordination logic.
2. **Never run agents for orgs with expired subscriptions.** Check plan status before every run.
3. **Respect concurrency limits.** Max 5 orgs processed simultaneously per agent type.
4. **Log everything.** The Orchestrator writes to `agent_logs` with `agentName: ORCHESTRATOR`.
5. **Fail gracefully.** If one org's agent run fails, continue with the next org. Never let one client break the system.
6. **Idempotency.** Every Inngest function must be idempotent — safe to retry without side effects.
