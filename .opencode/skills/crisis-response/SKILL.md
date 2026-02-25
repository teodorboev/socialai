---
name: crisis-response
description: "Activates on crisis detection (viral complaint, negative press, brand safety incident). Pauses publishing, drafts holding statements, prepares response templates, briefs humans. The difference between a PR disaster and a handled situation."
---

# SKILL: Crisis Response Agent

> **Prerequisite**: Read `base-agent` skill first.

---

## Purpose

When Social Listening, Engagement, or manual escalation detects a potential crisis, this agent takes immediate automated action to protect the brand, then briefs the human team with everything they need to respond effectively. Speed is everything in crisis management — this agent buys the team time and provides clarity.

**This agent ALWAYS escalates to human. It takes protective actions automatically but NEVER publishes a crisis response without human approval.**

---

## File Location

```
agents/crisis-response.ts
lib/ai/prompts/crisis-response.ts
lib/ai/schemas/crisis-response.ts
inngest/functions/crisis-protocol.ts
```

---

## Crisis Detection Triggers

| Source | Trigger | Threshold |
|--------|---------|-----------|
| Social Listening | sentiment_drop | >20% decline in 4 hours |
| Social Listening | mention_spike | >5x average hourly volume with negative sentiment |
| Social Listening | crisis_potential | Multiple converging negative signals |
| Engagement | viral_complaint | Single complaint >50 replies or >10K impressions |
| Engagement | crisis keyword detected | From SafetyConfig: "lawsuit", "boycott", "scam", "fraud" |
| Manual | Human triggers crisis mode | Dashboard → Crisis Mode button |
| News | Negative press article | Detected by Social Listening web scan |

---

## Immediate Automated Actions (No LLM, No Human Approval Needed)

```typescript
async function activateCrisisProtocol(organizationId: string, trigger: CrisisTrigger) {
  // 1. PAUSE all scheduled content immediately
  await prisma.schedule.updateMany({
    where: { organizationId, status: "PENDING" },
    data: { status: "PAUSED_CRISIS", pausedAt: new Date() },
  });

  // 2. PAUSE auto-engagement responses
  await prisma.orgSettings.update({
    where: { organizationId },
    data: { autoEngagementEnabled: false, crisisMode: true, crisisActivatedAt: new Date() },
  });

  // 3. LOG the crisis activation
  await prisma.crisisEvent.create({
    data: {
      organizationId,
      trigger: trigger.type,
      triggerDetails: trigger.details,
      status: "ACTIVE",
      activatedAt: new Date(),
    },
  });

  // 4. NOTIFY via all channels
  await sendCrisisNotification(organizationId, trigger);
  // - Email to all org admins
  // - Supabase Realtime push to dashboard
  // - If configured: Slack webhook, SMS
}
```

---

## Output Schema (LLM Analysis)

```typescript
const CrisisAssessmentSchema = z.object({
  severity: z.enum(["potential", "developing", "active", "critical"]),
  category: z.enum([
    "product_issue",          // Product defect, service outage
    "customer_complaint",     // Viral individual complaint
    "negative_press",         // Media coverage
    "employee_conduct",       // Staff behavior going viral
    "social_media_mistake",   // Brand posted something offensive
    "competitor_attack",      // Competitor or troll campaign
    "data_breach",            // Security/privacy incident
    "misinformation",         // False claims spreading about the brand
    "legal_threat",           // Lawsuit, regulatory action
    "influencer_fallout",     // Influencer partnership gone wrong
  ]),

  situation: z.object({
    summary: z.string().describe("2-3 sentence plain-English summary of what's happening"),
    timeline: z.array(z.object({
      time: z.string(),
      event: z.string(),
    })),
    currentScale: z.object({
      mentions: z.number(),
      estimatedReach: z.number(),
      sentimentBreakdown: z.object({ positive: z.number(), negative: z.number(), neutral: z.number() }),
      platformsAffected: z.array(z.string()),
      keyVoices: z.array(z.string()).describe("Influential accounts driving the conversation"),
    }),
    spreadRisk: z.enum(["contained", "spreading", "viral"]),
  }),

  responseTemplates: z.array(z.object({
    scenario: z.string().describe("What this response assumes is true"),
    platform: z.string(),
    tone: z.enum(["empathetic", "factual", "apologetic", "assertive"]),
    message: z.string(),
    doNot: z.array(z.string()).describe("What NOT to say in this scenario"),
  })).min(2).max(4),

  internalBrief: z.object({
    recommendedActions: z.array(z.object({
      action: z.string(),
      priority: z.enum(["immediate", "within_1_hour", "within_24_hours"]),
      owner: z.enum(["social_team", "pr_team", "legal", "executive", "customer_support"]),
    })),
    talkingPoints: z.array(z.string()),
    avoidAtAllCosts: z.array(z.string()),
    escalationPath: z.string().describe("Who should be looped in if this escalates further"),
  }),

  monitoringPlan: z.object({
    keyMetricsToWatch: z.array(z.string()),
    checkFrequency: z.string(),
    resolutionCriteria: z.string().describe("What conditions indicate the crisis has passed"),
  }),

  confidenceScore: z.number().min(0).max(1),
});
```

---

## Database

```prisma
model CrisisEvent {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trigger         String
  triggerDetails  Json
  severity        String?
  category        String?
  assessment      Json?    // Full CrisisAssessmentSchema output
  status          String   @default("ACTIVE") // ACTIVE → MONITORING → RESOLVED → POST_MORTEM
  activatedAt     DateTime @default(now())
  resolvedAt      DateTime?
  resolvedBy      String?
  postMortem      String?  @db.Text
  lessonsLearned  String[]

  @@index([organizationId, status])
}
```

---

## Crisis Lifecycle

```
TRIGGER DETECTED
    ↓
IMMEDIATE ACTIONS (automated, no approval)
  - Pause all scheduled content
  - Disable auto-engagement
  - Notify team via all channels
    ↓
LLM ASSESSMENT (runs automatically)
  - Analyze severity, category, scale
  - Generate response templates
  - Create internal brief
    ↓
ESCALATE TO HUMAN (always)
  - Dashboard shows crisis banner
  - Full brief + response templates ready
  - Human picks a response, edits if needed, approves
    ↓
MONITORING (agent continues tracking)
  - Sentiment updates every 15 minutes
  - Alerts on escalation or de-escalation
  - Updates brief if new information emerges
    ↓
RESOLUTION (human declares crisis over)
  - Resume scheduled content
  - Re-enable auto-engagement
  - Agent generates post-mortem summary
    ↓
POST-MORTEM
  - What happened, what worked, what didn't
  - Update crisis playbook for future incidents
  - Store lessons learned
```

---

## Schedule

```typescript
// Event-driven — no cron. Triggers from other agents.
export const crisisProtocol = inngest.createFunction(
  { id: "crisis-protocol", retries: 0 },  // No retries — must succeed first time
  { event: "crisis/detected" },
  async ({ event, step }) => {
    // 1. Activate crisis protocol (automated actions)
    await step.run("activate-protocol", () => activateCrisisProtocol(...));

    // 2. Run LLM assessment
    const assessment = await step.run("assess-crisis", () => {
      const agent = new CrisisResponseAgent();
      return agent.run(event.data.organizationId, event.data);
    });

    // 3. Store assessment and escalate
    await step.run("escalate", () => {
      // Update CrisisEvent with assessment
      // Send detailed brief to all admin channels
    });

    // 4. Start monitoring loop
    await step.run("start-monitoring", () => {
      return inngest.send({ name: "crisis/monitor", data: { ... } });
    });
  }
);

// Monitoring loop during active crisis
export const crisisMonitor = inngest.createFunction(
  { id: "crisis-monitor" },
  { event: "crisis/monitor" },
  async ({ event, step }) => {
    // Check if crisis is still active
    // Re-scan sentiment
    // Update assessment if situation changed
    // If resolution criteria met → notify human
    // Otherwise → schedule next check in 15 minutes
    await step.sleepUntil("next-check", addMinutes(new Date(), 15));
    await inngest.send({ name: "crisis/monitor", data: { ... } });
  }
);
```

---

## Rules

1. **NEVER auto-publish crisis responses.** Always escalate to human.
2. **ALWAYS pause content immediately.** Don't wait for LLM analysis to finish.
3. **Speed over perfection.** The first assessment can be refined — getting the brief to humans fast is the priority.
4. **Multiple response templates.** Provide 2-4 options for different scenarios because the team may have information the AI doesn't.
5. **Track resolution.** Don't just detect crises — monitor through resolution and generate post-mortems.
