---
name: goal-tracking
description: "Continuously measures progress toward the client's stated goal. Auto-adjusts strategy when falling behind. Reports honestly: 'We're 23% behind target — here's what I'm changing.' Closes the loop between 'what do you want' and 'are we getting there.'"
---

# SKILL: Autonomous Goal Tracking

> This is a SYSTEM skill that connects Strategy, Analytics, and the Orchestrator.
> **Prerequisite**: Read `base-agent` and `ai-first-ux` skills first.

---

## Purpose

The client said "drive website sales" during onboarding. But nothing currently checks whether the AI is actually achieving that. This system closes the loop: it takes the stated goal, breaks it into measurable targets, continuously tracks progress, automatically adjusts strategy when falling behind, and reports honestly to the human.

The AI isn't just doing stuff. It's doing stuff toward a specific outcome and knows whether it's working.

---

## File Location

```
lib/goals/tracker.ts
lib/goals/targets.ts
lib/goals/adjustments.ts
```

---

## Goal Types

```typescript
type GoalType =
  | "grow_followers"          // Increase follower count
  | "drive_website_traffic"   // Clicks to website
  | "drive_sales"             // Revenue from social
  | "increase_engagement"     // Engagement rate improvement
  | "build_awareness"         // Reach and impressions growth
  | "generate_leads"          // Lead form submissions, DMs, email signups
  | "launch_product"          // Successful product launch campaign
  | "build_community"         // Community health metrics
  | "improve_brand_perception" // Sentiment score improvement
  | "custom";                 // Client-defined custom goal
```

---

## Goal Configuration

Set during onboarding, adjustable via "Talk to AI":

```prisma
model Goal {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  type            String
  description     String   // "Drive website sales through social media"
  isActive        Boolean  @default(true)
  priority        Int      @default(1)  // 1 = primary goal

  // Targets (set by AI based on historical data + industry benchmarks)
  targets         Json     // GoalTargets object
  currentProgress Json?    // Latest progress snapshot
  adjustments     Json?    // Strategy adjustments made to achieve goal

  // Timeline
  startDate       DateTime @default(now())
  targetDate      DateTime? // Optional deadline
  achievedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId, isActive])
}

model GoalCheckpoint {
  id              String   @id @default(uuid())
  goalId          String
  organizationId  String
  progress        Json     // Full progress snapshot
  onTrack         Boolean
  pacePercentage  Float    // 100 = on pace, 80 = 20% behind, 120 = 20% ahead
  narrative       String   @db.Text // LLM-generated progress summary
  adjustmentsMade String[] // What the AI changed this checkpoint
  checkedAt       DateTime @default(now())

  @@index([goalId, checkedAt])
}
```

---

## Target Setting (AI-Generated)

```typescript
interface GoalTargets {
  // Monthly milestones
  milestones: Array<{
    month: number;          // Month 1, 2, 3...
    target: number;         // Target value for this month
    metric: string;         // What we're measuring
    baseline: number;       // Where we started
  }>;

  // Key performance indicators
  kpis: Array<{
    name: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    measurementFrequency: string; // "daily", "weekly", "monthly"
  }>;

  // Leading indicators (predict whether we'll hit the goal)
  leadingIndicators: Array<{
    name: string;
    description: string;
    targetRange: { min: number; max: number };
    currentValue: number;
  }>;
}

// Example for "drive_sales" goal:
const salesGoalTargets: GoalTargets = {
  milestones: [
    { month: 1, target: 500, metric: "social_clicks_to_website", baseline: 120 },
    { month: 2, target: 1200, metric: "social_clicks_to_website", baseline: 120 },
    { month: 3, target: 2500, metric: "social_clicks_to_website", baseline: 120 },
  ],
  kpis: [
    { name: "Monthly social revenue", currentValue: 340, targetValue: 5000, unit: "$", measurementFrequency: "monthly" },
    { name: "Click-through rate", currentValue: 0.8, targetValue: 2.5, unit: "%", measurementFrequency: "weekly" },
    { name: "Conversion rate from social", currentValue: 1.2, targetValue: 3.0, unit: "%", measurementFrequency: "monthly" },
  ],
  leadingIndicators: [
    { name: "Posts with CTAs", description: "% of posts that include a website link or CTA", targetRange: { min: 30, max: 50 }, currentValue: 15 },
    { name: "Product content ratio", description: "% of content featuring products", targetRange: { min: 25, max: 40 }, currentValue: 10 },
    { name: "Engagement on product posts", description: "Avg engagement on product-focused content", targetRange: { min: 3.0, max: 6.0 }, currentValue: 1.9 },
  ],
};
```

---

## Progress Tracking

```typescript
// Runs weekly via Orchestrator (after Analytics + ROI Attribution)

async function checkGoalProgress(organizationId: string): Promise<GoalCheckpoint[]> {
  const goals = await prisma.goal.findMany({
    where: { organizationId, isActive: true },
  });

  const checkpoints: GoalCheckpoint[] = [];

  for (const goal of goals) {
    // 1. Measure current values for all KPIs
    const currentMetrics = await measureGoalKPIs(organizationId, goal);

    // 2. Calculate pace (are we on track?)
    const pace = calculatePace(goal, currentMetrics);

    // 3. If off-track: generate adjustments
    let adjustments: string[] = [];
    if (pace.pacePercentage < 85) {
      adjustments = await generateGoalAdjustments(organizationId, goal, currentMetrics, pace);
      // Auto-apply adjustments via Orchestrator
      await applyGoalAdjustments(organizationId, goal, adjustments);
    }

    // 4. Generate narrative
    const narrative = await generateProgressNarrative(goal, currentMetrics, pace, adjustments);

    // 5. Store checkpoint
    const checkpoint = await prisma.goalCheckpoint.create({
      data: {
        goalId: goal.id,
        organizationId,
        progress: currentMetrics,
        onTrack: pace.pacePercentage >= 85,
        pacePercentage: pace.pacePercentage,
        narrative,
        adjustmentsMade: adjustments,
      },
    });

    checkpoints.push(checkpoint);

    // 6. Store in shared memory
    await memory.store({
      organizationId,
      content: `Goal "${goal.description}" progress: ${pace.pacePercentage.toFixed(0)}% of pace. ${pace.pacePercentage < 85 ? "BEHIND target." : "On track."} ${adjustments.length > 0 ? `Adjustments made: ${adjustments.join(", ")}` : "No adjustments needed."}`,
      memoryType: "strategy_decision",
      agentSource: "GOAL_TRACKING",
      importance: pace.pacePercentage < 85 ? 0.9 : 0.5,
    });
  }

  return checkpoints;
}
```

---

## Auto-Adjustments

When falling behind, the system automatically adjusts:

```typescript
async function generateGoalAdjustments(
  orgId: string,
  goal: Goal,
  currentMetrics: any,
  pace: PaceResult,
): Promise<string[]> {
  const adjustments: string[] = [];

  // Goal-specific automatic adjustments:
  switch (goal.type) {
    case "drive_sales":
    case "drive_website_traffic":
      if (currentMetrics.postsWithCTAs < goal.targets.leadingIndicators[0].targetRange.min) {
        adjustments.push("Increasing CTA frequency — adding website links to 40% of posts (was 15%)");
        await updateOrgContentMix(orgId, { ctaFrequency: 0.4 });
      }
      if (currentMetrics.productContentRatio < 0.25) {
        adjustments.push("Shifting content mix — increasing product-focused posts to 30% (was 10%)");
        await updateOrgContentMix(orgId, { productRatio: 0.3 });
      }
      break;

    case "grow_followers":
      if (currentMetrics.reelsPercentage < 0.3) {
        adjustments.push("Increasing Reels — they drive 4x more follower growth than static posts");
        await updateOrgContentMix(orgId, { reelsRatio: 0.35 });
      }
      if (currentMetrics.hashtagDiscoveryReach < 10) {
        adjustments.push("Switching to higher-volume discovery hashtags to increase reach");
        // Hashtag Optimizer will pick up the new directive
      }
      break;

    case "increase_engagement":
      if (currentMetrics.questionHookRatio < 0.3) {
        adjustments.push("Using more question hooks — they drive 2x more comments for your audience");
      }
      if (currentMetrics.postingFrequency < goal.targets.kpis.find(k => k.name === "Posts per week")?.targetValue) {
        adjustments.push("Increasing posting frequency to meet engagement volume targets");
      }
      break;

    case "build_awareness":
      adjustments.push("Prioritizing shareable content formats — infographics, statistics, Reels");
      adjustments.push("Increasing hashtag reach by using more discovery-category hashtags");
      break;
  }

  // LLM generates additional strategic adjustments
  const aiAdjustments = await generateAIAdjustments(orgId, goal, currentMetrics, pace);
  adjustments.push(...aiAdjustments);

  return adjustments;
}
```

---

## Mission Control Integration

Goal progress appears in two places:

### Weekly Pulse
```
"Goal: Drive website sales
 Progress: 67% of target pace
 This month: 823 clicks (target: 1,200) | $1,890 revenue (target: $3,000)
 I've increased product content to 30% and added more CTAs to close the gap.
 At current trajectory, we'll hit 85% of the monthly target."
```

### Needs Attention (when significantly off-track)
```
⚠️ Goal falling behind: "Drive website sales" is at 52% pace
   AI has made automatic adjustments but recommends:
   [Review proposed changes]  [Talk to AI about it]
```

---

## Rules

1. **Every org must have at least one goal.** Set during onboarding.
2. **AI sets realistic targets.** Based on historical data + industry benchmarks. Don't promise 10x growth in month 1.
3. **Check weekly.** Monthly is too slow to course-correct.
4. **Auto-adjust aggressively when behind.** Don't wait for human input to shift content mix.
5. **Report honestly.** Never hide that we're behind. Clients respect transparency.
6. **Celebrate milestones.** When a target is hit: push notification + activity feed + win section.
7. **Adjust targets if unrealistic.** If after 2 months we're consistently at 50% pace despite adjustments, suggest revising targets: "Based on your account's growth patterns, I recommend adjusting the monthly target from 2,500 clicks to 1,500. Here's why..."
