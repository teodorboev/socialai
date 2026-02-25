---
name: churn-prediction
description: "Monitors per-client platform engagement, content performance trends, and behavioral signals to predict churn risk before cancellation. Triggers retention actions: win emails, strategy refreshes, account manager alerts. Directly protects MRR."
---

# SKILL: Churn Prediction Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

Monitors client behavior signals and content performance to identify clients at risk of churning before they cancel. Calculates a churn risk score, classifies the likely reason, and triggers proactive retention actions. This agent directly protects monthly recurring revenue.

**This agent does NOT interact with clients directly.** It alerts the internal team and triggers automated retention workflows.

---

## File Location

```
agents/churn-prediction.ts
lib/ai/schemas/churn-prediction.ts
inngest/functions/churn-monitoring.ts
```

---

## Risk Signals (from DB — configurable)

| Signal Category | Metric | Weight |
|----------------|--------|--------|
| **Platform engagement** | Login frequency declining | High |
| | Content approval rate declining | High |
| | Days since last dashboard visit | High |
| | Time spent in dashboard declining | Medium |
| **Content performance** | Engagement rate declining 3+ weeks | High |
| | Follower growth stalled or negative | Medium |
| | Content rejection rate increasing | Medium |
| **Operational** | Escalations increasing | Medium |
| | Support tickets submitted | Medium |
| | Failed publishes not addressed | Low |
| **Billing** | Payment failed | Critical |
| | Downgraded plan | Critical |
| | Approaching contract renewal | Medium |
| **Behavioral** | Disconnected a social account | Critical |
| | Stopped responding to escalations | High |
| | Removed team members | Medium |

---

## Output Schema

```typescript
const ChurnAssessmentSchema = z.object({
  organizationId: z.string(),
  riskScore: z.number().min(0).max(100)
    .describe("0 = no risk, 100 = almost certainly churning"),
  riskLevel: z.enum(["healthy", "watch", "at_risk", "critical"]),
  // healthy: 0-25, watch: 26-50, at_risk: 51-75, critical: 76-100

  primaryRiskFactors: z.array(z.object({
    factor: z.string(),
    signal: z.string(),
    trend: z.string(),
    weight: z.number(),
  })).max(5),

  likelyChurnReason: z.enum([
    "poor_performance",       // Content isn't getting results
    "low_engagement_with_platform", // They're not using the dashboard
    "too_expensive",          // Downgraded or payment issues
    "competitor_switch",      // Behavioral signals suggest shopping around
    "outgrew_product",        // Need features we don't offer
    "loss_of_champion",       // Key user left the client's team
    "trust_breakdown",        // Too many errors, escalations, or missed expectations
    "unknown",
  ]),

  retentionRecommendations: z.array(z.object({
    action: z.enum([
      "send_win_email",           // Automated: highlight their recent wins
      "trigger_strategy_refresh",  // Automated: run Strategy Agent with fresh analysis
      "offer_account_review",      // Automated: email offering a free strategy call
      "alert_account_manager",     // For managed service: human outreach
      "offer_plan_adjustment",     // Suggest right-sizing their plan
      "send_feature_highlight",    // Show them features they're not using
      "schedule_qbr",             // Quarterly business review
      "escalate_to_leadership",   // Client likely to churn — executive attention needed
    ]),
    priority: z.enum(["immediate", "this_week", "this_month"]),
    reasoning: z.string(),
    automatable: z.boolean(),
  })),

  healthMetrics: z.object({
    daysAsCustomer: z.number(),
    currentMrr: z.number(),
    lifetimeValue: z.number(),
    avgEngagementRate: z.number(),
    dashboardVisitsLast30d: z.number(),
    contentApprovalRate: z.number(),
    escalationsLast30d: z.number(),
    lastLoginAt: z.string(),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Scoring Model

```typescript
// Weighted scoring — no LLM needed for base score
function calculateChurnRisk(signals: ChurnSignals): number {
  let score = 0;

  // Platform engagement (max 30 points)
  if (signals.daysSinceLastLogin > 14) score += 15;
  else if (signals.daysSinceLastLogin > 7) score += 8;

  if (signals.loginFrequencyTrend === "declining") score += 10;
  if (signals.approvalRateTrend === "declining") score += 5;

  // Content performance (max 25 points)
  if (signals.engagementRateTrend === "declining" && signals.declineWeeks >= 3) score += 15;
  if (signals.followerGrowth < 0) score += 10;

  // Billing (max 25 points)
  if (signals.paymentFailed) score += 20;
  if (signals.recentDowngrade) score += 15;
  if (signals.nearingRenewal && signals.otherRiskSignals) score += 10;

  // Behavioral (max 20 points)
  if (signals.disconnectedAccount) score += 15;
  if (signals.escalationsIncreasing) score += 5;
  if (signals.stoppedRespondingToEscalations) score += 10;

  return Math.min(score, 100);
}

// LLM used only for:
// 1. Determining likely churn reason (pattern matching across signals)
// 2. Personalizing retention recommendations
// 3. Writing the "win email" content
```

---

## Retention Actions (Automated)

```typescript
// Win Email: highlight their recent successes
async function sendWinEmail(orgId: string) {
  const wins = await getRecentWins(orgId);  // Top posts, follower milestones, engagement improvements
  const emailTemplate = await prisma.emailTemplate.findUnique({ where: { slug: "retention_wins" } });
  // Render and send via Resend
}

// Strategy Refresh: re-run Strategy Agent with fresh analysis
async function triggerStrategyRefresh(orgId: string) {
  await inngest.send({ name: "strategy/refresh", data: { organizationId: orgId, reason: "retention" } });
}

// Feature Highlight: show them features they haven't used
async function sendFeatureHighlight(orgId: string) {
  const unusedFeatures = await getUnusedFeatures(orgId);
  // Send personalized email about top 3 unused features
}
```

---

## Database

```prisma
model ChurnAssessment {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  riskScore       Int
  riskLevel       String
  primaryFactors  Json
  likelyReason    String
  recommendations Json
  healthMetrics   Json
  retentionActionsTaken String[]
  assessedAt      DateTime @default(now())

  @@index([organizationId, assessedAt])
  @@index([riskLevel])
}
```

---

## Schedule

```typescript
// Weekly: assess all clients
export const churnMonitoring = inngest.createFunction(
  { id: "churn-monitoring" },
  { cron: "0 6 * * 1" },  // Monday 6am
  async ({ step }) => {
    const orgs = await step.run("get-active-orgs", () =>
      prisma.organization.findMany({ where: { status: "ACTIVE" } })
    );

    for (const org of orgs) {
      const assessment = await step.run(`assess-${org.id}`, async () => {
        const agent = new ChurnPredictionAgent();
        return agent.run(org.id, await gatherChurnSignals(org.id));
      });

      // Execute automated retention actions
      if (assessment.data.riskLevel === "at_risk" || assessment.data.riskLevel === "critical") {
        for (const rec of assessment.data.retentionRecommendations) {
          if (rec.automatable && rec.priority === "immediate") {
            await step.run(`retention-${org.id}-${rec.action}`, () =>
              executeRetentionAction(org.id, rec.action)
            );
          }
        }
      }
    }
  }
);

// Real-time: trigger on critical signals
export const churnCriticalSignal = inngest.createFunction(
  { id: "churn-critical-signal" },
  { event: "billing/payment-failed" },  // Also: account/disconnected, plan/downgraded
  async ({ event, step }) => {
    // Immediate reassessment when a critical signal fires
  }
);
```

---

## Dashboard (Internal — Super Admin)

Super Admin → Client Health:
- Table of all clients sorted by churn risk score
- Color-coded: 🟢 Healthy, 🟡 Watch, 🟠 At Risk, 🔴 Critical
- Click into any client: see full assessment, signals, recommended actions, action history
- Filter by risk level, plan type, days as customer
- "Take Action" dropdown: trigger any retention action manually
