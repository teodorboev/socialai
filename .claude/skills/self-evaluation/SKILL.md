---
name: self-evaluation
description: "After every post gets 7 days of data, the system compares what each agent predicted vs what actually happened. Feeds discrepancies back to every agent in the pipeline. The system calibrates itself over time. No competitor does this."
---

# SKILL: Agent Self-Evaluation Loop

> This is a SYSTEM skill — not an agent. It's a feedback loop that makes ALL agents smarter.
> **Prerequisite**: Read `base-agent` and `shared-memory` skills first.

---

## Purpose

Every agent in the content-creation pipeline makes predictions and decisions. The Content Creator picks a hook. The Hashtag Optimizer picks hashtags. The Predictive Content Agent estimates engagement. The Creative Director picks a visual style. The Calendar Optimizer picks a time slot.

After the post publishes and accumulates real-world performance data, this system asks: **who was right and who was wrong?** It compares every agent's decisions against actual outcomes and feeds the learnings back — automatically, continuously, for every single post.

Over months, the entire pipeline self-calibrates. Predictions get more accurate. Content gets better. The gap between the AI's judgment and reality shrinks.

---

## File Location

```
lib/evaluation/evaluator.ts
lib/evaluation/agent-scorecard.ts
lib/evaluation/feedback-loop.ts
inngest/functions/post-mortem.ts
```

---

## When It Runs

```
Post publishes → Wait 7 days → Post-Mortem evaluation runs → Learnings stored in Shared Memory
```

```typescript
// Triggered by Orchestrator daily scan
export const postMortemScan = inngest.createFunction(
  { id: "post-mortem-scan" },
  { cron: "0 5 * * *" },  // Daily 5am
  async ({ step }) => {
    // Find all posts published exactly 7 days ago that haven't been evaluated
    const posts = await step.run("find-posts", () =>
      prisma.content.findMany({
        where: {
          publishedAt: {
            gte: subDays(new Date(), 8),
            lt: subDays(new Date(), 7),
          },
          postMortemCompletedAt: null,
        },
        include: {
          prediction: true,
          hashtagSet: true,
          voiceCheck: true,
          complianceCheck: true,
          generatedVisual: true,
        },
      })
    );

    for (const post of posts) {
      await step.run(`evaluate-${post.id}`, () => evaluatePost(post));
    }
  }
);
```

---

## Evaluation Per Agent

```typescript
// lib/evaluation/evaluator.ts

interface PostMortem {
  contentId: string;
  organizationId: string;
  publishedAt: Date;
  evaluatedAt: Date;

  actualPerformance: {
    impressions: number;
    reach: number;
    engagementRate: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    conversions: number;
    percentileRank: number;   // Where this post ranks among all org posts (0-100)
  };

  agentEvaluations: AgentEvaluation[];
  overallVerdict: "hit" | "miss" | "average";
  keyLearnings: string[];     // LLM-generated insights
}

interface AgentEvaluation {
  agent: string;
  predicted: any;             // What the agent decided/predicted
  actual: any;                // What actually happened
  accuracy: number;           // 0-1 score
  lesson: string;             // What should change
}
```

### Per-Agent Evaluation Logic

```typescript
async function evaluatePost(post: ContentWithRelations): Promise<PostMortem> {
  const actual = await getPerformanceData(post.id);
  const orgAvg = await getOrgAverageEngagement(post.organizationId, post.platform);
  const evaluations: AgentEvaluation[] = [];

  // ── CONTENT CREATOR ──────────────────────────────────
  evaluations.push({
    agent: "CONTENT_CREATOR",
    predicted: {
      topic: post.topic,
      hookType: post.hookType,
      captionLength: post.caption.length,
      contentType: post.contentType,
    },
    actual: {
      engagementRate: actual.engagementRate,
      percentile: actual.percentileRank,
    },
    accuracy: actual.percentileRank / 100,
    lesson: actual.percentileRank < 30
      ? `Post about "${post.topic}" with ${post.hookType} hook underperformed. Consider different angle or hook type for this topic.`
      : actual.percentileRank > 80
        ? `Post about "${post.topic}" with ${post.hookType} hook was a hit. Replicate this combination.`
        : `Post performed at average levels. No strong signal.`,
  });

  // ── PREDICTIVE CONTENT ───────────────────────────────
  if (post.prediction) {
    const predictedRate = post.prediction.predictedEngagement;
    const actualRate = actual.engagementRate;
    const error = Math.abs(predictedRate - actualRate);
    const relativeError = predictedRate > 0 ? error / predictedRate : 1;

    evaluations.push({
      agent: "PREDICTIVE_CONTENT",
      predicted: {
        engagementRate: predictedRate,
        percentile: post.prediction.performancePercentile,
        recommendation: post.prediction.publishRecommendation,
      },
      actual: {
        engagementRate: actualRate,
        percentile: actual.percentileRank,
      },
      accuracy: Math.max(0, 1 - relativeError),
      lesson: relativeError > 0.5
        ? `Prediction was off by ${(relativeError * 100).toFixed(0)}%. Predicted ${predictedRate.toFixed(2)}%, actual ${actualRate.toFixed(2)}%. ${predictedRate > actualRate ? "Model is overconfident" : "Model is underconfident"} for ${post.contentType} about ${post.topic}.`
        : `Prediction was within ${(relativeError * 100).toFixed(0)}% — good calibration.`,
    });
  }

  // ── HASHTAG OPTIMIZER ────────────────────────────────
  if (post.hashtagSet) {
    // Compare hashtag-attributed reach (if platform provides per-hashtag data)
    evaluations.push({
      agent: "HASHTAG_OPTIMIZER",
      predicted: {
        hashtags: post.hashtags,
        strategy: post.hashtagSet.name,
      },
      actual: {
        hashtagReach: actual.hashtagReach ?? null,
        discoveryPercentage: actual.impressionsFromHashtags ?? null,
      },
      accuracy: actual.impressionsFromHashtags
        ? Math.min(actual.impressionsFromHashtags / 20, 1)
        : 0.5, // Neutral if no data
      lesson: actual.impressionsFromHashtags && actual.impressionsFromHashtags < 5
        ? `Hashtags contributed <5% of impressions. Test different hashtag set for ${post.topic} content.`
        : `Hashtag strategy performed adequately.`,
    });
  }

  // ── BRAND VOICE GUARDIAN ─────────────────────────────
  if (post.voiceCheck) {
    evaluations.push({
      agent: "BRAND_VOICE_GUARDIAN",
      predicted: {
        voiceScore: post.voiceCheck.overallScore,
      },
      actual: {
        engagementRate: actual.engagementRate,
        commentSentiment: actual.commentSentiment,
      },
      accuracy: post.voiceCheck.overallScore / 100,
      lesson: post.voiceCheck.overallScore > 85 && actual.percentileRank < 30
        ? `Voice was on-brand but post underperformed — voice consistency alone doesn't guarantee performance.`
        : post.voiceCheck.overallScore < 70 && actual.percentileRank > 70
          ? `Voice score was low but post performed well — audience may respond to occasional voice variation.`
          : `Voice alignment and performance were consistent.`,
    });
  }

  // ── CREATIVE DIRECTOR ────────────────────────────────
  if (post.generatedVisual) {
    evaluations.push({
      agent: "CREATIVE_DIRECTOR",
      predicted: {
        visualType: post.generatedVisual.type,
        provider: post.generatedVisual.provider,
        layout: post.generatedVisual.templateData?.layout,
      },
      actual: {
        engagementRate: actual.engagementRate,
        savesRate: actual.saves / Math.max(actual.impressions, 1),
      },
      accuracy: actual.percentileRank / 100,
      lesson: actual.saves / Math.max(actual.impressions, 1) > 0.03
        ? `Visual was save-worthy (${((actual.saves / actual.impressions) * 100).toFixed(1)}% save rate). Replicate this visual style for ${post.topic}.`
        : `Visual didn't drive saves. Consider different visual approach for this content type.`,
    });
  }

  // ── CALENDAR OPTIMIZER (timing) ──────────────────────
  evaluations.push({
    agent: "CALENDAR_OPTIMIZER",
    predicted: {
      dayOfWeek: new Date(post.publishedAt).getDay(),
      hour: new Date(post.publishedAt).getHours(),
    },
    actual: {
      reachVsAverage: actual.reach / orgAvg.avgReach,
      engagementVsAverage: actual.engagementRate / orgAvg.avgEngagementRate,
    },
    accuracy: Math.min(actual.reach / orgAvg.avgReach, 1),
    lesson: actual.reach < orgAvg.avgReach * 0.7
      ? `Posting at ${new Date(post.publishedAt).getHours()}:00 on ${getDayName(post.publishedAt)} underperformed reach by ${((1 - actual.reach / orgAvg.avgReach) * 100).toFixed(0)}%. Consider different time slot.`
      : `Timing was effective.`,
  });

  // ── SOCIAL SEO ───────────────────────────────────────
  if (post.seoOptimized) {
    evaluations.push({
      agent: "SOCIAL_SEO",
      predicted: {
        keywords: post.seoKeywords,
        seoScore: post.seoScore,
      },
      actual: {
        impressionsFromSearch: actual.impressionsFromSearch ?? null,
        discoveryPercentage: actual.impressionsFromExplore ?? null,
      },
      accuracy: actual.impressionsFromExplore
        ? Math.min(actual.impressionsFromExplore / 15, 1)
        : 0.5,
      lesson: actual.impressionsFromExplore && actual.impressionsFromExplore > 15
        ? `SEO optimization drove ${actual.impressionsFromExplore}% of impressions from Explore/Search. Keywords "${post.seoKeywords?.slice(0, 3).join(", ")}" are working.`
        : `Low search/explore discoverability. Test different keywords.`,
    });
  }

  // ── GENERATE KEY LEARNINGS (LLM) ────────────────────
  const keyLearnings = await generateKeyLearnings(post, actual, evaluations);

  const postMortem: PostMortem = {
    contentId: post.id,
    organizationId: post.organizationId,
    publishedAt: post.publishedAt,
    evaluatedAt: new Date(),
    actualPerformance: actual,
    agentEvaluations: evaluations,
    overallVerdict: actual.percentileRank > 70 ? "hit" : actual.percentileRank < 30 ? "miss" : "average",
    keyLearnings,
  };

  // Store post-mortem
  await prisma.postMortem.create({ data: postMortem });

  // Store learnings in Shared Memory
  await storePostMortemMemories(postMortem);

  // Update content record
  await prisma.content.update({
    where: { id: post.id },
    data: { postMortemCompletedAt: new Date() },
  });

  return postMortem;
}
```

---

## Feeding Learnings Back

```typescript
// lib/evaluation/feedback-loop.ts

async function storePostMortemMemories(pm: PostMortem): Promise<void> {
  // Store overall learning
  await memory.store({
    organizationId: pm.organizationId,
    content: `Post-mortem for "${pm.contentId}": ${pm.overallVerdict}. ${pm.keyLearnings.join(" ")}`,
    memoryType: "content_performance",
    agentSource: "SELF_EVALUATION",
    contentId: pm.contentId,
    importance: pm.overallVerdict === "hit" ? 0.8 : pm.overallVerdict === "miss" ? 0.9 : 0.4,
    // Misses are MORE important to remember than hits — we learn more from failure
  });

  // Store per-agent lessons (only for significant findings)
  for (const eval of pm.agentEvaluations) {
    if (eval.accuracy < 0.4 || eval.accuracy > 0.85) {
      await memory.store({
        organizationId: pm.organizationId,
        content: `[${eval.agent}] ${eval.lesson}`,
        memoryType: "performance_pattern",
        agentSource: "SELF_EVALUATION",
        contentId: pm.contentId,
        importance: eval.accuracy < 0.4 ? 0.85 : 0.7,
      });
    }
  }
}
```

When any agent runs next, it recalls these memories:
- Content Creator recalls: "Post about vitamin C with question hook underperformed. Post about ingredient spotlight with statistic hook was a hit."
- Predictive Content recalls: "Model is overconfident for carousel posts — calibrate down 15%."
- Creative Director recalls: "Save-worthy visual was the minimal text overlay with product photo — replicate this style."

---

## Agent Scorecard

Track cumulative accuracy per agent per org:

```prisma
model AgentScorecard {
  id              String   @id @default(uuid())
  organizationId  String
  agentName       String
  period          String   // "2026-02", "2026-Q1"
  totalEvaluations Int     @default(0)
  avgAccuracy     Float    @default(0)
  trend           String?  // "improving", "stable", "declining"
  topLessons      String[] // Most repeated lessons
  updatedAt       DateTime @updatedAt

  @@unique([organizationId, agentName, period])
}
```

Updated weekly by Orchestrator. Visible in:
- Internal metrics (super admin)
- Reporting Narrator includes: "My prediction accuracy improved from 64% to 78% this month"
- Churn Prediction factors in: poor agent accuracy → client may notice bad content → churn risk

---

## Database

```prisma
model PostMortem {
  id              String   @id @default(uuid())
  contentId       String   @unique
  organizationId  String
  actualPerformance Json
  agentEvaluations Json    // Array of AgentEvaluation
  overallVerdict  String   // "hit", "miss", "average"
  keyLearnings    String[]
  evaluatedAt     DateTime @default(now())

  @@index([organizationId, evaluatedAt])
  @@index([organizationId, overallVerdict])
}
```

---

## Rules

1. **Every published post gets evaluated.** No exceptions. This is how the system learns.
2. **Wait 7 full days.** Posts need time to accumulate data. Evaluating too early gives misleading signals.
3. **Misses are more valuable than hits.** Weight failure learnings higher in memory (importance 0.9 vs 0.7 for hits).
4. **Never blame one agent.** Poor performance is usually multi-factor. The key learnings should identify the combination, not point fingers.
5. **Track accuracy trends.** If an agent's accuracy is declining, the Orchestrator should flag it and potentially increase human review for that agent's outputs.
6. **Feed back to the human too.** Weekly Pulse should include: "This week I learned: your audience prefers [X] over [Y]. I'm adjusting."
