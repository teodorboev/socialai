---
name: orchestrator-v2
description: "The single central brain. ALL agent execution flows through the Orchestrator. It decides what to run, when, in what order, with what priority. Mission Control watches it. Agents report to it. This is the nervous system of the entire platform."
---

# SKILL: Orchestrator — The Central Brain

> **This skill REPLACES the original `orchestrator` skill.**
> **Prerequisite**: Read `base-agent` and `ai-first-ux` skills first.

---

## Core Principle

```
There is ONE Orchestrator.
It is the ONLY thing that dispatches agents.
No agent calls another agent directly.
Every agent reports results back to the Orchestrator.
The Orchestrator decides what happens next.
Mission Control watches the Orchestrator's activity.
```

The Orchestrator is an Inngest-powered state machine. It runs on cron schedules AND reacts to events. It maintains a task queue, manages priorities, handles dependencies between agents, and implements circuit breakers when things fail.

---

## File Location

```
lib/orchestrator/brain.ts              → Core dispatch logic
lib/orchestrator/task-queue.ts         → Priority task queue
lib/orchestrator/pipelines.ts          → Multi-agent pipeline definitions
lib/orchestrator/circuit-breaker.ts    → Failure handling
inngest/functions/orchestrator.ts      → All cron triggers
inngest/functions/orchestrator-events.ts → All event triggers
```

---

## Architecture

```
                        ┌─────────────────────┐
                        │   INNGEST CRONS     │
                        │   + EVENT TRIGGERS  │
                        └─────────┬───────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │                          │
                    │      ORCHESTRATOR        │
                    │      (Central Brain)     │
                    │                          │
                    │  - Task Queue            │
                    │  - Pipeline Engine       │
                    │  - Priority Manager      │
                    │  - Circuit Breaker       │
                    │  - Activity Logger       │
                    │                          │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Agent A  │    │ Agent B  │    │ Agent C  │
        │          │    │          │    │          │
        │ Execute  │    │ Execute  │    │ Execute  │
        │ Return   │    │ Return   │    │ Return   │
        └────┬─────┘    └────┬─────┘    └────┬─────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    DATABASE      │
                    │  (agent_logs,    │
                    │   content,       │
                    │   schedules,     │
                    │   attention_items)│
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ MISSION CONTROL  │
                    │ (reads DB,       │
                    │  shows to human) │
                    └──────────────────┘
```

---

## Pipelines (Multi-Agent Workflows)

The Orchestrator doesn't just run individual agents. It runs **pipelines** — ordered sequences where each agent's output feeds the next.

```typescript
// lib/orchestrator/pipelines.ts

interface Pipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  onFailure: "abort" | "skip_step" | "retry";
}

interface PipelineStep {
  agent: AgentName;
  dependsOn?: string[];      // Wait for these steps to complete first
  condition?: (context: PipelineContext) => boolean; // Skip if false
  timeout: number;            // Max seconds
  onResult: (result: AgentResult) => PipelineAction;
}

type PipelineAction =
  | { action: "continue" }
  | { action: "abort"; reason: string }
  | { action: "escalate"; reason: string }
  | { action: "branch"; nextPipeline: string };
```

### Defined Pipelines

```typescript
const PIPELINES: Record<string, Pipeline> = {

  // ═══════════════════════════════════════════════════════
  // CONTENT CREATION PIPELINE (runs every 4 hours or on-demand)
  // ═══════════════════════════════════════════════════════
  "content-creation": {
    id: "content-creation",
    name: "Create & Publish Content",
    steps: [
      {
        agent: "STRATEGY",
        // Step 1: Check what content is needed based on the plan
        onResult: (r) => r.data.contentNeeded.length > 0
          ? { action: "continue" }
          : { action: "abort", reason: "No content needed right now" },
      },
      {
        agent: "TREND_SCOUT",
        // Step 2: Check for trending topics to incorporate
        dependsOn: ["STRATEGY"],
      },
      {
        agent: "CONTENT_CREATOR",
        // Step 3: Generate content (uses strategy plan + trend data as input)
        dependsOn: ["STRATEGY", "TREND_SCOUT"],
      },
      {
        agent: "HASHTAG_OPTIMIZER",
        // Step 4: Optimize hashtags on generated content
        dependsOn: ["CONTENT_CREATOR"],
      },
      {
        agent: "SOCIAL_SEO",
        // Step 5: Optimize for social search
        dependsOn: ["CONTENT_CREATOR"],
      },
      {
        agent: "BRAND_VOICE_GUARDIAN",
        // Step 6: Check voice consistency
        dependsOn: ["CONTENT_CREATOR", "HASHTAG_OPTIMIZER", "SOCIAL_SEO"],
        onResult: (r) => r.data.overallScore >= 70
          ? { action: "continue" }
          : { action: "escalate", reason: "Voice score too low" },
      },
      {
        agent: "PREDICTIVE_CONTENT",
        // Step 7: Predict performance
        dependsOn: ["BRAND_VOICE_GUARDIAN"],
      },
      {
        agent: "COMPLIANCE",
        // Step 8: Compliance check (hard gate)
        dependsOn: ["PREDICTIVE_CONTENT"],
        onResult: (r) => r.data.passed
          ? { action: "continue" }
          : { action: "escalate", reason: `Compliance: ${r.data.checks.filter(c => c.status === 'fail').map(c => c.category).join(', ')}` },
      },
      {
        agent: "VISUAL",
        // Step 9: Generate images/video if needed
        dependsOn: ["COMPLIANCE"],
        condition: (ctx) => ctx.contentNeedsMedia,
      },
      {
        // Step 10: Route to human or auto-schedule
        agent: "PUBLISHER",
        dependsOn: ["COMPLIANCE", "VISUAL"],
        // Publisher checks confidence + automation level
        // → auto-schedule OR create AttentionItem for human review
      },
    ],
    onFailure: "skip_step",
  },

  // ═══════════════════════════════════════════════════════
  // ENGAGEMENT PIPELINE (runs every 15 minutes)
  // ═══════════════════════════════════════════════════════
  "engagement": {
    id: "engagement",
    name: "Handle Engagement",
    steps: [
      {
        agent: "ENGAGEMENT",
        // Step 1: Fetch new comments/DMs, classify, draft responses
      },
      {
        agent: "COMPLIANCE",
        // Step 2: Check responses for compliance
        dependsOn: ["ENGAGEMENT"],
        condition: (ctx) => ctx.hasAutoResponses,
      },
      // Auto-responses with high confidence → publish directly
      // Escalations → create AttentionItem
    ],
    onFailure: "retry",
  },

  // ═══════════════════════════════════════════════════════
  // INTELLIGENCE PIPELINE (runs daily at 3am)
  // ═══════════════════════════════════════════════════════
  "daily-intelligence": {
    id: "daily-intelligence",
    name: "Daily Intelligence Gathering",
    steps: [
      { agent: "COMPETITOR_INTELLIGENCE" },
      { agent: "COMPETITIVE_AD_INTELLIGENCE" },
      { agent: "SOCIAL_LISTENING" },
      { agent: "PRICING_INTELLIGENCE", condition: (ctx) => ctx.org.isEcommerce },
      {
        agent: "SENTIMENT_INTELLIGENCE",
        dependsOn: ["SOCIAL_LISTENING"],
      },
      {
        // If sentiment drops or crisis signals detected
        agent: "CRISIS_RESPONSE",
        dependsOn: ["SENTIMENT_INTELLIGENCE"],
        condition: (ctx) => ctx.sentimentResult?.sentimentShift?.direction === "crisis",
      },
    ],
    onFailure: "skip_step",
  },

  // ═══════════════════════════════════════════════════════
  // WEEKLY REPORTING PIPELINE (runs Monday 8am)
  // ═══════════════════════════════════════════════════════
  "weekly-reporting": {
    id: "weekly-reporting",
    name: "Weekly Reports",
    steps: [
      { agent: "ANALYTICS" },
      { agent: "ROI_ATTRIBUTION", dependsOn: ["ANALYTICS"] },
      { agent: "CROSS_CHANNEL_ATTRIBUTION", dependsOn: ["ANALYTICS"] },
      { agent: "AUDIENCE_INTELLIGENCE", dependsOn: ["ANALYTICS"] },
      {
        agent: "REPORTING_NARRATOR",
        dependsOn: ["ANALYTICS", "ROI_ATTRIBUTION", "CROSS_CHANNEL_ATTRIBUTION"],
        // Generates the narrative report the human sees in Mission Control
      },
      {
        agent: "CAPTION_REWRITER",
        dependsOn: ["ANALYTICS"],
        // Identifies underperformers from the week and creates rewrites
      },
    ],
    onFailure: "skip_step",
  },

  // ═══════════════════════════════════════════════════════
  // MONTHLY STRATEGY PIPELINE (runs 1st of month)
  // ═══════════════════════════════════════════════════════
  "monthly-strategy": {
    id: "monthly-strategy",
    name: "Monthly Strategy Refresh",
    steps: [
      { agent: "ANALYTICS" },                    // Full month data
      { agent: "AUDIENCE_INTELLIGENCE" },         // Updated personas
      { agent: "COMPETITOR_INTELLIGENCE" },        // Competitive landscape
      { agent: "SENTIMENT_INTELLIGENCE" },         // Brand perception
      {
        agent: "STRATEGY",
        dependsOn: ["ANALYTICS", "AUDIENCE_INTELLIGENCE", "COMPETITOR_INTELLIGENCE", "SENTIMENT_INTELLIGENCE"],
        // Generate next month's strategy
      },
      // Strategy → create AttentionItem for human to review
    ],
    onFailure: "skip_step",
  },

  // ═══════════════════════════════════════════════════════
  // REPURPOSE PIPELINE (triggered by top performer detection)
  // ═══════════════════════════════════════════════════════
  "repurpose-top-content": {
    id: "repurpose-top-content",
    name: "Repurpose Top Content",
    steps: [
      { agent: "REPURPOSE" },
      { agent: "HASHTAG_OPTIMIZER", dependsOn: ["REPURPOSE"] },
      { agent: "BRAND_VOICE_GUARDIAN", dependsOn: ["REPURPOSE"] },
      { agent: "COMPLIANCE", dependsOn: ["BRAND_VOICE_GUARDIAN"] },
      { agent: "PUBLISHER", dependsOn: ["COMPLIANCE"] },
    ],
    onFailure: "skip_step",
  },

  // ═══════════════════════════════════════════════════════
  // CONTENT HEALTH CHECK (runs every 2 hours)
  // ═══════════════════════════════════════════════════════
  "content-health": {
    id: "content-health",
    name: "Content Pipeline Health",
    steps: [
      {
        agent: "CONTENT_REPLENISHMENT",
        // Checks if enough content is scheduled
        // If deficit → triggers content-creation pipeline
        onResult: (r) => {
          if (r.data.status === "critical" || r.data.status === "silent") {
            return { action: "branch", nextPipeline: "content-creation" };
          }
          return { action: "continue" };
        },
      },
      {
        agent: "CALENDAR_OPTIMIZER",
        // Rebalances the schedule
        dependsOn: ["CONTENT_REPLENISHMENT"],
      },
    ],
    onFailure: "retry",
  },

  // ═══════════════════════════════════════════════════════
  // COMMUNITY PIPELINE (runs daily)
  // ═══════════════════════════════════════════════════════
  "community": {
    id: "community",
    name: "Community Management",
    steps: [
      { agent: "UGC_CURATOR" },
      { agent: "COMMUNITY_BUILDER" },
      { agent: "REVIEW_RESPONSE" },
      {
        agent: "INFLUENCER_SCOUT",
        condition: (ctx) => ctx.dayOfWeek === 3, // Wednesdays only
      },
    ],
    onFailure: "skip_step",
  },

  // ═══════════════════════════════════════════════════════
  // ONBOARDING PIPELINE (runs once per new org)
  // ═══════════════════════════════════════════════════════
  "onboarding": {
    id: "onboarding",
    name: "New Client Onboarding Analysis",
    steps: [
      { agent: "ONBOARDING_INTELLIGENCE" },
      { agent: "AUDIENCE_INTELLIGENCE", dependsOn: ["ONBOARDING_INTELLIGENCE"] },
      { agent: "COMPETITOR_INTELLIGENCE", dependsOn: ["ONBOARDING_INTELLIGENCE"] },
      {
        agent: "STRATEGY",
        dependsOn: ["ONBOARDING_INTELLIGENCE", "AUDIENCE_INTELLIGENCE", "COMPETITOR_INTELLIGENCE"],
      },
      // Results feed into the onboarding conversation's "review plan" phase
    ],
    onFailure: "abort",
  },
};
```

---

## The Master Schedule

The Orchestrator owns ALL cron schedules. No individual agent has its own cron.

```typescript
// inngest/functions/orchestrator.ts

// ── Every 15 minutes ──────────────────────────────────
export const tick15m = inngest.createFunction(
  { id: "orchestrator-15m", retries: 2 },
  { cron: "*/15 * * * *" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "engagement");
  }
);

// ── Every 30 minutes ──────────────────────────────────
export const tick30m = inngest.createFunction(
  { id: "orchestrator-30m", retries: 2 },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "social-listening-quick");
    // social-listening-quick is just the SOCIAL_LISTENING agent, not the full intelligence pipeline
  }
);

// ── Every 2 hours ─────────────────────────────────────
export const tick2h = inngest.createFunction(
  { id: "orchestrator-2h", retries: 2 },
  { cron: "0 */2 * * *" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "content-health");
  }
);

// ── Every 4 hours ─────────────────────────────────────
export const tick4h = inngest.createFunction(
  { id: "orchestrator-4h", retries: 2 },
  { cron: "0 */4 * * *" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "content-creation");
  }
);

// ── Daily at 3am ──────────────────────────────────────
export const tickDaily = inngest.createFunction(
  { id: "orchestrator-daily", retries: 1 },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "daily-intelligence");
    await runPipelineForAllOrgs(step, "community");
    await runChurnCheck(step);           // Churn Prediction for all orgs
    await runAdaptiveConfidence(step);   // Adjust thresholds based on behavior
    await runROIDataSync(step);          // Sync attribution data from GA4/Shopify
  }
);

// ── Weekly Monday 8am ─────────────────────────────────
export const tickWeekly = inngest.createFunction(
  { id: "orchestrator-weekly" },
  { cron: "0 8 * * 1" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "weekly-reporting");
    await runHashtagAnalysis(step);
    await runVoiceDriftCheck(step);
    await runSEOResearch(step);
  }
);

// ── Monthly 1st at 9am ────────────────────────────────
export const tickMonthly = inngest.createFunction(
  { id: "orchestrator-monthly" },
  { cron: "0 9 1 * *" },
  async ({ step }) => {
    await runPipelineForAllOrgs(step, "monthly-strategy");
  }
);
```

---

## Event-Driven Triggers

```typescript
// inngest/functions/orchestrator-events.ts

// ── Content approved by human ─────────────────────────
export const onContentApproved = inngest.createFunction(
  { id: "orchestrator-content-approved" },
  { event: "content/approved" },
  async ({ event, step }) => {
    // If localization enabled → run localization pipeline
    // Schedule for publishing
    // If high performer later → trigger repurpose pipeline
  }
);

// ── Top performer detected ────────────────────────────
export const onTopPerformer = inngest.createFunction(
  { id: "orchestrator-top-performer" },
  { event: "analytics/top-performer" },
  async ({ event, step }) => {
    await runPipeline(event.data.organizationId, step, "repurpose-top-content", {
      contentId: event.data.contentId,
    });
    // Also check: media pitch opportunity?
    await runAgent(event.data.organizationId, step, "MEDIA_PITCH", {
      trigger: "viral_content",
      contentId: event.data.contentId,
    });
  }
);

// ── Crisis detected ───────────────────────────────────
export const onCrisis = inngest.createFunction(
  { id: "orchestrator-crisis", retries: 0 },
  { event: "crisis/detected" },
  async ({ event, step }) => {
    // IMMEDIATE: No queue, no priority — execute NOW
    await runAgent(event.data.organizationId, step, "CRISIS_RESPONSE", event.data);
  }
);

// ── New account connected (onboarding) ────────────────
export const onAccountConnected = inngest.createFunction(
  { id: "orchestrator-onboarding" },
  { event: "account/connected" },
  async ({ event, step }) => {
    const isFirstAccount = await step.run("check-first", async () => {
      const count = await prisma.socialAccount.count({
        where: { organizationId: event.data.organizationId },
      });
      return count === 1;
    });

    if (isFirstAccount) {
      await runPipeline(event.data.organizationId, step, "onboarding");
    }
  }
);

// ── Human says something via "Talk to AI" ─────────────
export const onHumanCommand = inngest.createFunction(
  { id: "orchestrator-human-command" },
  { event: "human/command" },
  async ({ event, step }) => {
    // Parse the command (already done by Talk to AI interface)
    // Dispatch to the relevant agent or pipeline
    const { action, params } = event.data.parsedCommand;

    switch (action) {
      case "create_content":
        await runPipeline(event.data.organizationId, step, "content-creation", params);
        break;
      case "create_campaign":
        await runAgent(event.data.organizationId, step, "STRATEGY", {
          type: "campaign", ...params,
        });
        break;
      case "update_schedule":
      case "update_voice":
      case "update_mix":
      case "add_competitor":
        // Direct DB updates (no agent needed)
        await step.run("update-config", () => updateOrgConfig(event.data.organizationId, action, params));
        break;
      case "get_analytics":
      case "explain_performance":
        await runAgent(event.data.organizationId, step, "ANALYTICS", params);
        break;
    }
  }
);

// ── Payment failed ────────────────────────────────────
export const onPaymentFailed = inngest.createFunction(
  { id: "orchestrator-payment-failed" },
  { event: "billing/payment-failed" },
  async ({ event, step }) => {
    await runAgent(event.data.organizationId, step, "CHURN_PREDICTION", {
      trigger: "payment_failed",
    });
  }
);
```

---

## Pipeline Execution Engine

```typescript
// lib/orchestrator/brain.ts

async function runPipeline(
  organizationId: string,
  step: InngestStep,
  pipelineId: string,
  context: Record<string, any> = {},
): Promise<PipelineResult> {
  const pipeline = PIPELINES[pipelineId];
  if (!pipeline) throw new Error(`Unknown pipeline: ${pipelineId}`);

  const pipelineRun = await step.run(`pipeline-start-${pipelineId}`, () =>
    prisma.pipelineRun.create({
      data: {
        organizationId,
        pipelineId,
        status: "running",
        context,
        startedAt: new Date(),
      },
    })
  );

  const results: Record<string, AgentResult> = {};
  const pipelineContext: PipelineContext = { ...context, org: await getOrgConfig(organizationId) };

  for (const pipelineStep of pipeline.steps) {
    const stepId = `${pipelineId}-${pipelineStep.agent}`;

    // Check dependencies
    if (pipelineStep.dependsOn) {
      const allDepsComplete = pipelineStep.dependsOn.every(dep => results[dep]);
      if (!allDepsComplete) continue;
    }

    // Check condition
    if (pipelineStep.condition && !pipelineStep.condition(pipelineContext)) {
      await logActivity(organizationId, `Skipped ${pipelineStep.agent} — condition not met`);
      continue;
    }

    // Check circuit breaker
    if (await isCircuitOpen(organizationId, pipelineStep.agent)) {
      await logActivity(organizationId, `Skipped ${pipelineStep.agent} — circuit breaker open`);
      continue;
    }

    // Execute agent
    try {
      const result = await step.run(stepId, () =>
        runAgent(organizationId, pipelineStep.agent, {
          ...pipelineContext,
          previousResults: results,
        })
      );

      results[pipelineStep.agent] = result;

      // Log activity (this is what Mission Control shows)
      await logActivity(organizationId, agentActivityMessage(pipelineStep.agent, result));

      // Check onResult handler
      if (pipelineStep.onResult) {
        const action = pipelineStep.onResult(result);
        switch (action.action) {
          case "abort":
            await logActivity(organizationId, `Pipeline ${pipelineId} aborted: ${action.reason}`);
            return { status: "aborted", reason: action.reason, results };
          case "escalate":
            await createAttentionItem(organizationId, {
              type: "agent_escalation",
              agent: pipelineStep.agent,
              reason: action.reason,
              result,
            });
            break;
          case "branch":
            await runPipeline(organizationId, step, action.nextPipeline, pipelineContext);
            break;
          case "continue":
          default:
            break;
        }
      }

      // Handle agent's own escalation flag
      if (result.shouldEscalate) {
        await createAttentionItem(organizationId, {
          type: "agent_escalation",
          agent: pipelineStep.agent,
          reason: result.escalationReason,
          result,
        });
      }

    } catch (error) {
      await logActivity(organizationId, `${pipelineStep.agent} failed: ${error.message}`);
      await recordCircuitFailure(organizationId, pipelineStep.agent);

      switch (pipeline.onFailure) {
        case "abort":
          return { status: "failed", error, results };
        case "retry":
          // Inngest handles retries at the function level
          throw error;
        case "skip_step":
          continue;
      }
    }
  }

  // Update pipeline run
  await step.run(`pipeline-complete-${pipelineId}`, () =>
    prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: { status: "completed", completedAt: new Date(), results },
    })
  );

  return { status: "completed", results };
}
```

---

## Activity Logger (Feeds Mission Control)

```typescript
// Every agent action becomes a human-readable activity item

async function logActivity(organizationId: string, message: string, metadata?: any) {
  await prisma.activityLog.create({
    data: {
      organizationId,
      message,
      metadata,
      createdAt: new Date(),
    },
  });

  // Push real-time update to Mission Control via Supabase Realtime
  await supabase.channel(`org:${organizationId}`).send({
    type: "broadcast",
    event: "activity",
    payload: { message, createdAt: new Date() },
  });
}

function agentActivityMessage(agent: AgentName, result: AgentResult): string {
  // Translate agent results into human-readable Mission Control messages
  const messages: Record<string, (r: AgentResult) => string> = {
    CONTENT_CREATOR: (r) => `Generated ${r.data.posts?.length || 0} new posts`,
    PUBLISHER: (r) => `Published "${r.data.caption?.slice(0, 50)}..." on ${r.data.platform}`,
    ENGAGEMENT: (r) => `Replied to ${r.data.repliesCount || 0} comments`,
    TREND_SCOUT: (r) => r.data.trendsFound > 0
      ? `Detected trending topic: ${r.data.topTrend} → creating content`
      : `Scanned trends — nothing relevant right now`,
    COMPETITOR_INTELLIGENCE: (r) => `Scanned competitors — ${r.data.gaps?.length || 0} opportunities found`,
    SOCIAL_LISTENING: (r) => `${r.data.mentionCount} brand mentions found (${r.data.sentimentBreakdown?.positive || 0}% positive)`,
    ANALYTICS: (r) => `Collected performance data: ${r.data.toplineMetrics?.engagement || 'N/A'}% avg engagement`,
    REPORTING_NARRATOR: (r) => `Weekly report generated and emailed`,
    CRISIS_RESPONSE: (r) => `⚠️ Crisis detected: ${r.data.situation?.summary}`,
    COMPLIANCE: (r) => r.data.passed ? `Compliance check passed` : `⚠️ Compliance issue: ${r.data.checks?.filter(c => c.status === 'fail').map(c => c.category).join(', ')}`,
    CONTENT_REPLENISHMENT: (r) => r.data.status === 'healthy'
      ? `Content pipeline healthy — ${r.data.scheduledNext48h} posts scheduled`
      : `⚠️ Content pipeline ${r.data.status} — triggering content creation`,
    CAPTION_REWRITER: (r) => `Rewrote ${r.data.rewrites?.length || 0} underperforming posts for a second chance`,
    UGC_CURATOR: (r) => r.data.candidates?.length > 0
      ? `Found ${r.data.candidates.length} user-generated content opportunities`
      : `Scanned for UGC — nothing new`,
    REVIEW_RESPONSE: (r) => `Responded to ${r.data.responses?.length || 0} new reviews`,
    COMMUNITY_BUILDER: (r) => `Community health: ${r.data.communityHealth?.trend || 'stable'}`,
    CHURN_PREDICTION: (r) => `Client health check complete — risk: ${r.data.riskLevel}`,
    // ... one for every agent
  };

  return messages[agent]?.(result) || `${agent} completed`;
}
```

---

## Database

```prisma
model PipelineRun {
  id              String   @id @default(uuid())
  organizationId  String
  pipelineId      String
  status          String   @default("running") // running, completed, failed, aborted
  context         Json?
  results         Json?
  error           String?
  startedAt       DateTime
  completedAt     DateTime?

  @@index([organizationId, pipelineId, startedAt])
}

model ActivityLog {
  id              String   @id @default(uuid())
  organizationId  String
  message         String
  metadata        Json?
  createdAt       DateTime @default(now())

  @@index([organizationId, createdAt])
}

model AttentionItem {
  id              String   @id @default(uuid())
  organizationId  String
  type            String   // "content_review", "escalation", "crisis", "strategy_proposal", etc.
  title           String
  description     String?  @db.Text
  data            Json     // Type-specific payload
  priority        String   @default("normal") // "low", "normal", "high", "critical"
  status          String   @default("pending") // "pending", "acted", "dismissed", "expired"
  deadline        DateTime?
  actedAt         DateTime?
  actedBy         String?
  createdAt       DateTime @default(now())

  @@index([organizationId, status, priority])
  @@index([organizationId, createdAt])
}

model CircuitBreaker {
  id              String   @id @default(uuid())
  organizationId  String
  agentName       String
  failureCount    Int      @default(0)
  lastFailure     DateTime?
  isOpen          Boolean  @default(false)
  opensAt         DateTime?  // When circuit opened
  resetAt         DateTime?  // When to try again

  @@unique([organizationId, agentName])
}
```

---

## Circuit Breaker

```typescript
// If an agent fails 3 times in a row, stop calling it for 1 hour
const FAILURE_THRESHOLD = 3;
const RESET_AFTER_MINUTES = 60;

async function isCircuitOpen(orgId: string, agent: string): Promise<boolean> {
  const breaker = await prisma.circuitBreaker.findUnique({
    where: { organizationId_agentName: { organizationId: orgId, agentName: agent } },
  });
  if (!breaker?.isOpen) return false;
  if (breaker.resetAt && new Date() > breaker.resetAt) {
    // Try to reset
    await prisma.circuitBreaker.update({
      where: { id: breaker.id },
      data: { isOpen: false, failureCount: 0 },
    });
    return false;
  }
  return true;
}

async function recordCircuitFailure(orgId: string, agent: string) {
  const breaker = await prisma.circuitBreaker.upsert({
    where: { organizationId_agentName: { organizationId: orgId, agentName: agent } },
    create: { organizationId: orgId, agentName: agent, failureCount: 1, lastFailure: new Date() },
    update: { failureCount: { increment: 1 }, lastFailure: new Date() },
  });

  if (breaker.failureCount >= FAILURE_THRESHOLD) {
    await prisma.circuitBreaker.update({
      where: { id: breaker.id },
      data: {
        isOpen: true,
        opensAt: new Date(),
        resetAt: addMinutes(new Date(), RESET_AFTER_MINUTES),
      },
    });

    await logActivity(orgId, `⚠️ ${agent} circuit breaker opened — too many failures. Will retry in ${RESET_AFTER_MINUTES} minutes.`);
  }
}
```

---

## How Mission Control Reads This

Mission Control makes ZERO API calls to agents. It only reads from the database:

```typescript
// Mission Control data sources:

// Metrics strip → analytics tables (updated by ANALYTICS agent)
// Needs Attention → attention_items table (created by Orchestrator)
// AI Activity → activity_log table (written by Orchestrator after every agent)
// Coming Up → schedules table (created by PUBLISHER agent)
// Wins → activity_log filtered for positive events
// Weekly Pulse → narrative_reports table (created by REPORTING_NARRATOR)

// All real-time via Supabase Realtime subscriptions
// No polling. No API calls. Just database reads.
```

---

## Summary

```
1. The Orchestrator is the ONLY thing that runs on schedules
2. The Orchestrator dispatches ALL agents via defined pipelines
3. Pipelines define the order, dependencies, conditions, and failure handling
4. Every agent writes results to the database
5. The Orchestrator translates results into human-readable activity messages
6. Mission Control ONLY reads the database — it never touches agents
7. "Needs Attention" items are created by the Orchestrator when human input is required
8. "Talk to AI" commands are routed through the Orchestrator as events
9. Circuit breakers protect against cascading failures
10. The human sees a calm, simple dashboard. The Orchestrator handles the complexity.
```
