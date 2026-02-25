---
name: llm-caching
description: "Three-layer LLM cost reduction system: (1) engagement scan deduplication via Redis — skip Claude when no new activity, (2) Anthropic prompt caching — pay only for variable tokens when system prompts are static, (3) template short-circuit — bypass LLM entirely for predictable low-value responses. Targets ~50% cost reduction. READ THIS before building the engagement agent, content creation pipeline, or any high-frequency agent."
---

# SKILL: LLM Caching & Cost Reduction

> This is a SYSTEM skill — not an agent. It's infrastructure used by BaseAgent and the Orchestrator.
> **Prerequisite**: Read `base-agent` and `orchestrator` skills first.

---

## Purpose

Your platform makes ~6,400 LLM calls per client per month at ~$123 AI cost unoptimized.
The engagement agent alone accounts for ~54% of that. Without caching you cannot price below $200/mo and remain profitable.

This skill implements three independent caching layers that stack:

| Layer | Mechanism | Saves | Effort |
|-------|-----------|-------|--------|
| 1. Engagement scan deduplication | Redis activity hash | ~25% | Low |
| 2. Anthropic prompt caching | `cache_control` headers | ~10% | Low |
| 3. Template short-circuit | Keyword classifier → template pool | ~15% | Medium |

**Combined target: ~50% cost reduction.**
Each layer is independently deployable. Build them in order.

---

## File Location

```
lib/caching/engagement-dedup.ts     → Layer 1: Redis scan deduplication
lib/caching/prompt-cache.ts         → Layer 2: Anthropic prompt caching wrapper
lib/caching/template-responder.ts   → Layer 3: Template short-circuit
lib/caching/index.ts                → Unified export
agents/shared/base-agent.ts         → Modified to use layers 2 + 3
inngest/functions/engagement-monitor.ts → Modified to use layer 1
```

---

## Layer 1: Engagement Scan Deduplication

### The Problem

The engagement agent runs every 15 minutes = 2,880 calls/month per client.
On average, most of those scans find **nothing new** — no new comments, no new DMs.
But today, Claude is called every time regardless. That's ~2,500 wasted calls/month per client.

### How It Works

Before calling the social platform API (let alone Claude), compute a hash of the latest
activity state for that org+platform. Compare it to the last stored hash. If identical → skip.

```
SCAN TRIGGER
    │
    ▼
Fetch latest activity IDs from platform API (cheap, fast)
    │
    ▼
Hash the activity state (last N comment IDs + DM IDs + mention IDs)
    │
    ├── Hash == stored hash? → SKIP (no LLM call, no platform read, just log "no new activity")
    │
    └── Hash differs? → Update stored hash → proceed to engagement agent → call Claude
```

### Implementation

```typescript
// lib/caching/engagement-dedup.ts

import { redis } from "@/lib/redis";
import { createHash } from "crypto";

const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24 hours — expire stale hashes daily

interface ActivitySnapshot {
  commentIds: string[];
  dmIds: string[];
  mentionIds: string[];
  mostRecentTimestamp: string;
}

/**
 * Generates a stable hash from an activity snapshot.
 * Order-insensitive: sorts IDs before hashing so different API response
 * orderings don't produce false "new activity" signals.
 */
function hashActivitySnapshot(snapshot: ActivitySnapshot): string {
  const normalized = {
    comments: [...snapshot.commentIds].sort(),
    dms: [...snapshot.dmIds].sort(),
    mentions: [...snapshot.mentionIds].sort(),
    ts: snapshot.mostRecentTimestamp,
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 16); // 16 chars is plenty for dedup
}

function dedupKey(organizationId: string, platform: string): string {
  return `engagement:dedup:${organizationId}:${platform}`;
}

/**
 * Checks if activity has changed since the last scan.
 *
 * Returns:
 *   { changed: false }  → Skip this scan entirely. No LLM call needed.
 *   { changed: true, newItems: [...] }  → Proceed. Pass newItems to engagement agent.
 */
export async function checkEngagementChanged(
  organizationId: string,
  platform: string,
  currentSnapshot: ActivitySnapshot
): Promise<{ changed: false } | { changed: true; snapshot: ActivitySnapshot }> {
  const key = dedupKey(organizationId, platform);
  const currentHash = hashActivitySnapshot(currentSnapshot);

  const storedHash = await redis.get(key);

  if (storedHash === currentHash) {
    return { changed: false };
  }

  // Update the stored hash (with TTL to auto-expire orphaned orgs)
  await redis.set(key, currentHash, { ex: DEDUP_TTL_SECONDS });

  return { changed: true, snapshot: currentSnapshot };
}

/**
 * Force-invalidates the dedup cache for an org+platform.
 * Call this when a client connects a new account or if a scan should be forced.
 */
export async function invalidateEngagementCache(
  organizationId: string,
  platform: string
): Promise<void> {
  await redis.del(dedupKey(organizationId, platform));
}

/**
 * Returns cache hit stats for the admin dashboard cost view.
 */
export async function getEngagementCacheStats(
  organizationId: string
): Promise<{ platform: string; lastHash: string | null }[]> {
  const platforms = ["instagram", "facebook", "tiktok", "twitter", "linkedin"];
  return Promise.all(
    platforms.map(async (platform) => ({
      platform,
      lastHash: await redis.get(dedupKey(organizationId, platform)),
    }))
  );
}
```

### Integration Point: Inngest Engagement Monitor

```typescript
// inngest/functions/engagement-monitor.ts  (modified section)

export const engagementMonitor = inngest.createFunction(
  { id: "engagement-monitor", concurrency: { limit: 10 } },
  { cron: "*/15 * * * *" },  // Every 15 minutes
  async ({ step }) => {

    const activeOrgs = await step.run("get-active-orgs", () =>
      prisma.subscription.findMany({
        where: { status: { in: ["active", "trialing"] } },
        include: { organization: { include: { socialAccounts: true } } },
      })
    );

    for (const sub of activeOrgs) {
      const org = sub.organization;

      for (const account of org.socialAccounts) {
        await step.run(`check-${org.id}-${account.platform}`, async () => {

          // Fetch lightweight activity snapshot (IDs only, not full content)
          // This is a cheap platform API call — no LLM involved
          const snapshot = await fetchActivitySnapshot(account);

          // LAYER 1: Dedup check
          const dedupResult = await checkEngagementChanged(
            org.id,
            account.platform,
            snapshot
          );

          if (!dedupResult.changed) {
            // ✅ Cache HIT — skip LLM entirely
            await logCacheHit(org.id, "engagement_dedup", account.platform);
            return; // Done. No Claude call.
          }

          // Cache MISS — fetch full content for new items only, then run agent
          const newEngagements = await fetchNewEngagements(
            account,
            dedupResult.snapshot
          );

          if (newEngagements.length === 0) return;

          // Dispatch to Orchestrator → engagement agent
          await inngest.send({
            name: "engagement/new-activity",
            data: { organizationId: org.id, platform: account.platform, engagements: newEngagements },
          });
        });
      }
    }
  }
);
```

---

## Layer 2: Anthropic Prompt Caching

### The Problem

Every ContentCreatorAgent call for the same org sends the same 2,000-token system prompt
(role, brand voice, platform rules, content guidelines) plus 500 tokens of variable input.
You're paying for 2,000 tokens of input 180 times/month when you could pay for it once per hour.

Anthropic prompt caching lets you mark static blocks as cacheable. Once cached (5 min TTL,
extendable to 1 hour with `ephemeral`), you only pay for the variable portion of subsequent calls.
Cache write costs 25% more; cache reads cost 90% less. Net result: ~10% overall savings on heavy agents.

### Which Agents Benefit Most

| Agent | Static Portion | Variable Portion | Cache Benefit |
|-------|----------------|------------------|---------------|
| Content Creator | System prompt + brand voice + platform rules | Topic/trend input | High |
| Engagement | System prompt + FAQ + brand dos/don'ts | Each engagement item | High |
| Brand Voice Guardian | System prompt + voice profile | Post to check | High |
| Compliance | System prompt + rules | Post to check | High |
| Hashtag Optimizer | System prompt + platform rules | Post content | Medium |
| Strategy | System prompt | Context data | Low (few calls) |

### Implementation

```typescript
// lib/caching/prompt-cache.ts

import Anthropic from "@anthropic-ai/sdk";

type CachableBlock = Anthropic.TextBlockParam & {
  cache_control?: { type: "ephemeral" };
};

/**
 * Wraps a system prompt string into Anthropic's cache_control format.
 *
 * Rules:
 * - Only the LAST block in a messages array can have cache_control.
 * - Split your system prompt into static (cacheable) + dynamic (not cached) parts.
 * - Minimum cacheable block: 1,024 tokens (~750 words). Smaller blocks are ignored by Anthropic.
 * - Cache TTL: 5 minutes default. Use "ephemeral" for up to 1 hour (billed at cache write price once).
 */
export function buildCachedSystemPrompt(
  staticPart: string,    // Brand voice, platform rules, agent role — changes rarely
  dynamicPart?: string   // Current date, recent context — changes every call
): CachableBlock[] {
  const blocks: CachableBlock[] = [
    {
      type: "text",
      text: staticPart,
      cache_control: { type: "ephemeral" },  // Mark for caching
    },
  ];

  if (dynamicPart) {
    blocks.push({
      type: "text",
      text: dynamicPart,
      // No cache_control — this changes every call, don't cache it
    });
  }

  return blocks;
}

/**
 * Extracts cache usage stats from a Claude response.
 * Log these to agent_cost_events for the admin cost dashboard.
 */
export function extractCacheStats(usage: Anthropic.Usage): {
  cacheReadTokens: number;
  cacheWriteTokens: number;
  regularInputTokens: number;
  estimatedSavings: number; // in USD
} {
  const cacheReadTokens = (usage as any).cache_read_input_tokens ?? 0;
  const cacheWriteTokens = (usage as any).cache_creation_input_tokens ?? 0;
  const regularInputTokens = usage.input_tokens ?? 0;

  // Sonnet pricing: $3/M regular input, $0.30/M cache read, $3.75/M cache write
  const regularCost = (regularInputTokens / 1_000_000) * 3.0;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * 0.30;
  const cacheWriteCost = (cacheWriteTokens / 1_000_000) * 3.75;
  const actualCost = regularCost + cacheReadCost + cacheWriteCost;

  // What it would have cost without caching
  const uncachedCost = ((regularInputTokens + cacheReadTokens) / 1_000_000) * 3.0;

  return {
    cacheReadTokens,
    cacheWriteTokens,
    regularInputTokens,
    estimatedSavings: Math.max(0, uncachedCost - actualCost),
  };
}
```

### Integration Point: BaseAgent

Modify `BaseAgent` to split system prompts into static + dynamic and pass cache blocks:

```typescript
// agents/shared/base-agent.ts  (modified callClaude method)

import { buildCachedSystemPrompt, extractCacheStats } from "@/lib/caching/prompt-cache";

abstract class BaseAgent {

  // Each agent must implement these two methods instead of one system prompt string:
  protected abstract getStaticSystemPrompt(orgContext: OrgContext): string;
  protected getDynamicSystemPromptContext?(orgContext: OrgContext): string | undefined;

  protected async callClaude<T>(params: {
    orgContext: OrgContext;
    userMessage: string;
    schema: z.ZodSchema<T>;
    model?: string;
  }): Promise<{ data: T; tokensUsed: number; cacheSavings: number }> {

    const staticPrompt = this.getStaticSystemPrompt(params.orgContext);
    const dynamicContext = this.getDynamicSystemPromptContext?.(params.orgContext);

    const systemBlocks = buildCachedSystemPrompt(staticPrompt, dynamicContext);

    const response = await this.client.messages.create({
      model: params.model ?? this.model,
      max_tokens: 2048,
      system: systemBlocks,
      messages: [{ role: "user", content: params.userMessage }],
      tools: [{
        name: "structured_output",
        description: "Output structured data",
        input_schema: zodToJsonSchema(params.schema),
      }],
      tool_choice: { type: "tool", name: "structured_output" },
    });

    const cacheStats = extractCacheStats(response.usage);
    const toolUse = response.content.find(b => b.type === "tool_use");
    const data = params.schema.parse((toolUse as any).input);

    return {
      data,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      cacheSavings: cacheStats.estimatedSavings,
    };
  }
}
```

### Example: Content Creator Static vs Dynamic Split

```typescript
// agents/content-creator.ts  (example split)

class ContentCreatorAgent extends BaseAgent {

  // STATIC — same for every call for this org. Gets cached after first call.
  protected getStaticSystemPrompt(ctx: OrgContext): string {
    return `
You are the AI content creator for ${ctx.brandName}.

BRAND VOICE:
${ctx.voiceTone.adjectives.join(", ")}
Examples of on-brand writing: ${ctx.voiceTone.examples.join(" | ")}
Never: ${ctx.voiceTone.avoid.join(", ")}

PLATFORM RULES:
${ctx.platforms.map(p => `${p.name}: max ${p.maxLength} chars, ${p.hashtagStrategy}`).join("\n")}

CONTENT STRATEGY:
Themes: ${ctx.themes.join(", ")}
Avoid repeating topics covered in the last 14 days.
Always end with a call to action.
    `.trim();
  }

  // DYNAMIC — changes every call (current date, recent posts). NOT cached.
  protected getDynamicSystemPromptContext(ctx: OrgContext): string {
    return `
Today: ${new Date().toISOString().split("T")[0]}
Posts published this week: ${ctx.recentPostCount}
Last 3 topics covered: ${ctx.recentTopics.join(", ")}
    `.trim();
  }
}
```

---

## Layer 3: Template Short-Circuit

### The Problem

Not every engagement needs Claude. Common responses are predictable and brand-safe:
- "Thanks! ❤️" reply to "Love this!" comment
- "DM us for details! 📩" reply to "How much does it cost?"
- "🙏 Thank you!" reply to a fire emoji comment

Calling Claude for these is waste. A lightweight classifier can handle them with zero LLM cost.

### How It Works

```
ENGAGEMENT ITEM arrives
    │
    ▼
Template classifier runs (fast, local, no LLM)
    │
    ├── MATCH found + confidence > 0.85 → Return template response → DONE (no Claude)
    │
    └── NO MATCH or low confidence → Send to Claude as normal
```

The classifier has two components:
1. **Category detector** — keyword/regex rules to classify engagement type
2. **Template pool** — per-org customizable response templates per category

Templates are stored in the database (not hardcoded), so clients can customize them via the brand settings UI. The AI can also improve templates over time based on engagement performance.

### Implementation

```typescript
// lib/caching/template-responder.ts

import { prisma } from "@/lib/prisma";

interface TemplateMatch {
  matched: true;
  response: string;
  category: string;
  confidence: number;
}

interface TemplateNoMatch {
  matched: false;
}

export type TemplateResult = TemplateMatch | TemplateNoMatch;

// ── DATABASE SCHEMA ────────────────────────────────────────────────────

// Add to prisma/schema.prisma:
//
// model EngagementTemplate {
//   id              String   @id @default(uuid())
//   organizationId  String
//   organization    Organization @relation(fields: [organizationId], references: [id])
//   category        String   // "appreciation", "price_inquiry", "emoji_only", etc.
//   platform        String?  // null = all platforms
//   triggers        String[] // keywords/patterns that activate this template
//   responses       String[] // pool of responses (one is picked randomly for variety)
//   isActive        Boolean  @default(true)
//   useCount        Int      @default(0)
//   successRate     Float?   // updated by self-evaluation agent
//   createdAt       DateTime @default(now())
//   updatedAt       DateTime @updatedAt
//
//   @@index([organizationId, category])
// }

// ── CLASSIFIER ────────────────────────────────────────────────────────

// Built-in categories with default trigger patterns.
// These seed the DB on org creation; clients can then customize.
const BUILT_IN_CATEGORIES: Array<{
  category: string;
  triggers: RegExp[];
  defaultResponses: string[];
  maxBodyLength: number; // Only match short, simple messages
}> = [
  {
    category: "emoji_only",
    triggers: [/^[\p{Emoji}\s]+$/u],
    defaultResponses: ["❤️", "🙏✨", "😊💫", "🔥"],
    maxBodyLength: 20,
  },
  {
    category: "appreciation_simple",
    triggers: [
      /^(love (this|it|you)|amazing|great|awesome|fantastic|beautiful|perfect|wow|so good|obsessed)[\s!.]*$/i,
      /^(this is (amazing|great|perfect|so good))[\s!.]*$/i,
    ],
    defaultResponses: [
      "Thank you so much! ❤️",
      "This means so much to us! 🙏",
      "You just made our day! ✨",
    ],
    maxBodyLength: 60,
  },
  {
    category: "want_to_buy",
    triggers: [
      /where (can i|do i) (buy|get|find|order)/i,
      /how (do i|can i) (buy|order|get one|purchase)/i,
      /is this (available|for sale|in stock)/i,
    ],
    defaultResponses: [
      "You can shop at the link in our bio! 🛍️",
      "Head to the link in our bio to grab yours! ✨",
    ],
    maxBodyLength: 120,
  },
  {
    category: "price_inquiry",
    triggers: [
      /how much (does|is|are|do)/i,
      /what('s| is) the (price|cost)/i,
      /\bprice\b|\bcost\b|\bhow much\b/i,
    ],
    defaultResponses: [
      "DM us for pricing details! 📩",
      "Send us a DM and we'll get you all the details! 💬",
    ],
    maxBodyLength: 80,
  },
  {
    category: "shipping_inquiry",
    triggers: [
      /do you (ship|deliver) to/i,
      /shipping to/i,
      /available in/i,
    ],
    defaultResponses: [
      "DM us with your location and we'll check for you! 📦",
      "Send us a DM for shipping info! 📩",
    ],
    maxBodyLength: 100,
  },
];

/**
 * Attempts to match an engagement body against template categories.
 * Returns a template response if confident, or { matched: false } to fall through to Claude.
 */
export async function tryTemplateResponse(params: {
  organizationId: string;
  platform: string;
  engagementBody: string;
  engagementType: "COMMENT" | "DIRECT_MESSAGE" | "MENTION" | "REPLY";
}): Promise<TemplateResult> {

  // DMs always go to Claude — they're more personal and nuanced
  if (params.engagementType === "DIRECT_MESSAGE") {
    return { matched: false };
  }

  const body = params.engagementBody.trim();

  // Fetch org-specific templates from DB (includes customized + AI-improved templates)
  const orgTemplates = await prisma.engagementTemplate.findMany({
    where: {
      organizationId: params.organizationId,
      isActive: true,
      OR: [{ platform: params.platform }, { platform: null }],
    },
  });

  // Check DB templates first (org-specific, possibly AI-improved)
  for (const template of orgTemplates) {
    for (const trigger of template.triggers) {
      const pattern = new RegExp(trigger, "i");
      if (pattern.test(body) && body.length <= 200) {
        const response = pickRandom(template.responses);

        // Track usage asynchronously (don't block response)
        prisma.engagementTemplate.update({
          where: { id: template.id },
          data: { useCount: { increment: 1 } },
        }).catch(() => {}); // Fire and forget

        return {
          matched: true,
          response,
          category: template.category,
          confidence: 0.90,
        };
      }
    }
  }

  // Fall back to built-in patterns if no org-specific templates exist yet
  for (const builtin of BUILT_IN_CATEGORIES) {
    if (body.length > builtin.maxBodyLength) continue;

    for (const trigger of builtin.triggers) {
      if (trigger.test(body)) {
        return {
          matched: true,
          response: pickRandom(builtin.defaultResponses),
          category: builtin.category,
          confidence: 0.85,
        };
      }
    }
  }

  return { matched: false };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Seeds default templates for a new org on creation.
 * Call from the onboarding pipeline after the org is created.
 */
export async function seedDefaultTemplates(organizationId: string): Promise<void> {
  const seeds = BUILT_IN_CATEGORIES.map((cat) => ({
    organizationId,
    category: cat.category,
    platform: null,
    triggers: cat.triggers.map((r) => r.source),
    responses: cat.defaultResponses,
    isActive: true,
  }));

  await prisma.engagementTemplate.createMany({
    data: seeds,
    skipDuplicates: true,
  });
}
```

### Integration Point: Engagement Agent

```typescript
// agents/engagement.ts  (modified execute method)

import { tryTemplateResponse } from "@/lib/caching/template-responder";

class EngagementAgent extends BaseAgent {
  async execute(input: EngagementInput): Promise<AgentResult<EngagementOutput>> {

    // LAYER 3: Try template short-circuit first
    const templateResult = await tryTemplateResponse({
      organizationId: input.organizationId,
      platform: input.platform,
      engagementBody: input.engagement.body,
      engagementType: input.engagement.type,
    });

    if (templateResult.matched) {
      // ✅ Template HIT — no LLM call
      await logCacheHit(input.organizationId, "template_short_circuit", {
        category: templateResult.category,
        platform: input.platform,
      });

      return {
        success: true,
        data: {
          response: templateResult.response,
          shouldRespond: true,
          sentiment: "POSITIVE",
          category: templateResult.category,
          source: "template",
        },
        confidenceScore: templateResult.confidence,
        shouldEscalate: false,
        tokensUsed: 0, // Zero LLM tokens
      };
    }

    // Template MISS → proceed to Claude as normal (Layer 2 prompt caching applies here)
    return this.callClaudeForEngagement(input);
  }
}
```

---

## Cost Tracking: agent_cost_events

Log every LLM call and cache event so the Admin dashboard can show real cost per client.

```prisma
// Add to prisma/schema.prisma

model AgentCostEvent {
  id              String   @id @default(uuid())
  organizationId  String
  agentName       String
  platform        String?

  // LLM usage (null if cache hit)
  tokensInput     Int?
  tokensOutput    Int?
  cacheReadTokens Int?
  cacheWriteTokens Int?
  model           String?

  // Estimated cost in USD (calculated at log time using current pricing)
  estimatedCostUsd Float

  // Cache outcome
  cacheLayer      String?  // "engagement_dedup" | "prompt_cache" | "template_short_circuit"
  cacheHit        Boolean  @default(false)

  createdAt       DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([agentName, cacheHit])
}
```

```typescript
// lib/caching/index.ts

export async function logCacheHit(
  organizationId: string,
  cacheLayer: "engagement_dedup" | "prompt_cache" | "template_short_circuit",
  meta?: Record<string, string>
): Promise<void> {
  await prisma.agentCostEvent.create({
    data: {
      organizationId,
      agentName: meta?.agentName ?? "unknown",
      platform: meta?.platform,
      estimatedCostUsd: 0,
      cacheLayer,
      cacheHit: true,
    },
  });
}

export async function logLLMCall(params: {
  organizationId: string;
  agentName: string;
  tokensInput: number;
  tokensOutput: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  model: string;
  cacheSavingsUsd?: number;
}): Promise<void> {
  // Pricing as of Sonnet 4 (update when model changes)
  const PRICING = {
    "claude-sonnet-4-20250514": { input: 3.0, output: 15.0, cacheRead: 0.30, cacheWrite: 3.75 },
    "claude-haiku-4-5-20251001": { input: 0.80, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
  };

  const p = PRICING[params.model as keyof typeof PRICING] ?? PRICING["claude-sonnet-4-20250514"];

  const estimatedCostUsd =
    (params.tokensInput / 1_000_000) * p.input +
    (params.tokensOutput / 1_000_000) * p.output +
    ((params.cacheReadTokens ?? 0) / 1_000_000) * p.cacheRead +
    ((params.cacheWriteTokens ?? 0) / 1_000_000) * p.cacheWrite;

  await prisma.agentCostEvent.create({
    data: {
      organizationId: params.organizationId,
      agentName: params.agentName,
      model: params.model,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      cacheReadTokens: params.cacheReadTokens ?? 0,
      cacheWriteTokens: params.cacheWriteTokens ?? 0,
      estimatedCostUsd,
      cacheHit: false,
    },
  });
}
```

---

## Admin Dashboard: Cost View

Add a `/admin/costs` page showing real margin per client:

```
┌─────────────────────────────────────────────────────────────────┐
│ 💰 AI Cost Dashboard             This month: Feb 2026          │
│                                                                 │
│ Total AI spend: $487.23   |   Clients: 12   |   Avg: $40.60   │
│ Cache hit rate: 63%        |   Savings vs uncached: $831.44    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Org           │ Plan    │ MRR    │ AI Cost │ Margin │ Status   │
│───────────────┼─────────┼────────┼─────────┼────────┼──────────│
│ PureGlow      │ Growth  │ $399   │ $38.20  │ 90.4%  │ ✅       │
│ TechStartup   │ Pro     │ $799   │ $71.50  │ 91.1%  │ ✅       │
│ FoodiesCo     │ Starter │ $199   │ $54.80  │ 72.5%  │ ⚠️ Low  │
│ StyleHouse    │ Growth  │ $399   │ $41.30  │ 89.6%  │ ✅       │
├─────────────────────────────────────────────────────────────────┤
│ Cache Layer Breakdown (this month)                              │
│                                                                 │
│ Engagement dedup:       4,821 hits  →  saved $86.78            │
│ Prompt caching:         6,233 hits  →  saved $18.70            │
│ Template short-circuit: 2,107 hits  →  saved $37.93            │
│                                                                 │
│ ⚠️  FoodiesCo has low cache hit rate (31%) — high engagement   │
│    volume. Consider upgrading to Growth plan.                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Redis Setup

This skill requires Redis for Layer 1 (engagement dedup). Use Upstash (serverless Redis, generous free tier, works on Vercel):

```typescript
// lib/redis.ts

import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

Add to `.env.example`:
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Build Order

Implement in this exact order. Each layer is independently valuable and testable:

**Phase 1 — Layer 1 (Engagement Dedup)**
1. Add Upstash Redis to the project
2. Implement `engagement-dedup.ts`
3. Modify `engagement-monitor.ts` to call `checkEngagementChanged` before dispatching
4. Add `AgentCostEvent` table + migration
5. Add `logCacheHit` calls
6. **Validate**: Watch agent_cost_events — you should see cache hits immediately

**Phase 2 — Layer 2 (Prompt Caching)**
1. Implement `prompt-cache.ts`
2. Refactor `BaseAgent.callClaude` to accept the static/dynamic prompt split
3. Update `ContentCreatorAgent`, `EngagementAgent`, `ComplianceAgent` to split their prompts
4. Add cache stats to `logLLMCall`
5. **Validate**: Check `cache_read_input_tokens` in Claude API responses — should be non-zero after first call per org

**Phase 3 — Layer 3 (Template Short-Circuit)**
1. Add `EngagementTemplate` table + migration
2. Implement `template-responder.ts`
3. Add `seedDefaultTemplates` call to onboarding pipeline
4. Modify `EngagementAgent.execute` to call `tryTemplateResponse` first
5. Build template management UI in brand settings (optional but adds client value)
6. **Validate**: Check `tokensUsed: 0` events in agent_cost_events for template hits

**Phase 4 — Admin Cost Dashboard**
1. Query `AgentCostEvent` grouped by org
2. Build `/admin/costs` page
3. Add ⚠️ alerts for orgs with margin below 70%

---

## Rules

1. **Never cache DMs.** Templates are for public comments only. DMs are too personal and high-stakes. Always send DMs to Claude.
2. **Template confidence floor is 0.85.** If the classifier isn't sure, fall through to Claude. False positives (wrong template response) are worse than the cost of a Claude call.
3. **Org templates override built-ins.** Always check DB templates first. The AI can improve them via the self-evaluation skill.
4. **Prompt cache only helps static content > 1,024 tokens.** Don't bother splitting prompts that are shorter than this — Anthropic ignores the cache_control directive.
5. **Log everything.** Every cache hit and miss goes to agent_cost_events. This is the only way to know if caching is working and which clients are unprofitable.
6. **Redis keys include org ID.** Never share dedup state across orgs. Use `engagement:dedup:{orgId}:{platform}` pattern strictly.
7. **Layer 2 is zero-risk.** Prompt caching is transparent — same responses, lower cost. Deploy it first if you want a quick win with no behavior change.
