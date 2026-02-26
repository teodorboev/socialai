---
name: smart-router
description: "Intelligent LLM routing system. Routes every platform request to the optimal model based on task complexity: budget models for simple tasks (70%), mid-tier for moderate (20%), flagship for complex (10%). Supports Anthropic, OpenAI, Google Gemini, and extensible to any provider. All model pricing managed from admin UI — zero hardcoding. Real-time cost tracking, profitability monitoring, and per-org cost attribution."
---

# SKILL: SmartRouter — Intelligent LLM Routing

> This is a CORE INFRASTRUCTURE skill. Every agent call flows through SmartRouter.
> **Prerequisite**: Read `base-agent` and `orchestrator` skills first.
> **Replaces**: Any direct `anthropic.messages.create()` calls in agent code. ALL LLM calls go through SmartRouter.

---

## Purpose

The platform runs 39+ agents making thousands of LLM calls daily. Not every call needs Claude Opus. A compliance check ("does this caption contain profanity?") is a classification task — a $0.25/M token budget model handles it perfectly. A full content strategy analysis needs flagship reasoning. SmartRouter ensures every request hits the right model at the right price.

This alone can cut LLM costs 40-60% without degrading output quality.

---

## Architecture

```
AGENT calls smartRouter.complete(...)
    │
    ├── 1. CLASSIFY request complexity (simple / moderate / complex)
    │
    ├── 2. RESOLVE model (find best available model for this tier + task type)
    │
    ├── 3. EXECUTE against provider SDK
    │
    ├── 4. TRACK cost (log tokens, model, cost, org, agent)
    │
    ├── 5. FALLBACK if provider fails (try next provider in tier)
    │
    └── 6. RETURN standardized response
```

---

## File Location

```
lib/router/index.ts                     → Main SmartRouter API
lib/router/classifier.ts                → Request complexity classification
lib/router/resolver.ts                  → Model selection logic
lib/router/providers/anthropic.ts       → Anthropic SDK adapter
lib/router/providers/openai.ts          → OpenAI SDK adapter
lib/router/providers/google.ts          → Google Gemini SDK adapter
lib/router/providers/base.ts            → Base provider interface
lib/router/cost-tracker.ts              → Cost logging and attribution
lib/router/fallback.ts                  → Provider failover chain
app/(admin)/router/models/page.tsx      → Super Admin model management
app/(admin)/router/costs/page.tsx       → Super Admin cost dashboard
app/(admin)/router/routing/page.tsx     → Super Admin routing rules
```

---

## Database

```prisma
// ════════════════════════════════════════════════════════
// PROVIDERS (managed from admin UI)
// ════════════════════════════════════════════════════════

model LLMProvider {
  id              String   @id @default(uuid())
  name            String   @unique   // "anthropic", "openai", "google", "mistral", "deepseek"
  displayName     String              // "Anthropic", "OpenAI", "Google Gemini"
  isActive        Boolean  @default(true)
  apiKeyEnvVar    String              // "ANTHROPIC_API_KEY" — references .env variable name
  baseUrl         String?             // Custom endpoint if needed (for proxies, Azure OpenAI, etc.)
  defaultHeaders  Json?               // Extra headers if needed
  rateLimitRpm    Int?                // Requests per minute limit
  rateLimitTpm    Int?                // Tokens per minute limit
  healthStatus    String   @default("healthy") // "healthy", "degraded", "down"
  lastHealthCheck DateTime?
  models          LLMModel[]
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ════════════════════════════════════════════════════════
// MODELS (managed from admin UI — all pricing here)
// ════════════════════════════════════════════════════════

model LLMModel {
  id              String   @id @default(uuid())
  providerId      String
  provider        LLMProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  modelId         String              // "claude-sonnet-4-5-20250929", "gpt-4o-mini", "gemini-2.0-flash"
  displayName     String              // "Claude Sonnet 4.5", "GPT-4o Mini", "Gemini 2.0 Flash"
  isActive        Boolean  @default(true)

  // Capability tier — drives routing decisions
  tier            String              // "budget", "mid", "flagship"

  // Pricing (per 1M tokens, in USD cents for precision)
  // Admin sets these — updated when providers change pricing
  inputPricePer1M   Int              // e.g., 300 = $3.00 per 1M input tokens
  outputPricePer1M  Int              // e.g., 1500 = $15.00 per 1M output tokens
  cachedInputPricePer1M Int?         // Prompt caching price if supported

  // Capabilities (what this model is good at)
  capabilities    String[]           // ["classification", "extraction", "generation", "reasoning", "coding", "vision", "json_mode", "tool_use"]

  // Limits
  maxInputTokens  Int                // Context window
  maxOutputTokens Int                // Max output
  supportsImages  Boolean @default(false)
  supportsToolUse Boolean @default(false)
  supportsJson    Boolean @default(false)
  supportsStreaming Boolean @default(true)
  supportsCaching Boolean @default(false)

  // Performance characteristics (updated from actual usage data)
  avgLatencyMs    Int?               // Measured average latency
  reliability     Float?             // 0-1 success rate from last 1000 calls

  // Routing priority within tier (lower = preferred)
  priorityInTier  Int      @default(0)

  routingRules    RoutingRule[]
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([providerId, modelId])
  @@index([tier, isActive])
}

// ════════════════════════════════════════════════════════
// ROUTING RULES (optional overrides — managed from admin UI)
// ════════════════════════════════════════════════════════

model RoutingRule {
  id              String   @id @default(uuid())
  name            String              // "Content Creator always uses Sonnet"
  description     String?
  isActive        Boolean  @default(true)
  priority        Int      @default(0) // Higher = checked first

  // Match conditions (any combination)
  matchAgent      String?             // "CONTENT_CREATOR", "COMPLIANCE", etc.
  matchTaskType   String?             // "classification", "generation", "analysis"
  matchTier       String?             // "budget", "mid", "flagship"

  // Route to specific model
  targetModelId   String
  targetModel     LLMModel @relation(fields: [targetModelId], references: [id])

  // Optional: override tier classification for this match
  overrideTier    String?             // Force a tier regardless of classifier

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([isActive, priority])
}

// ════════════════════════════════════════════════════════
// COST TRACKING (every LLM call is logged)
// ════════════════════════════════════════════════════════

model LLMUsageLog {
  id              String   @id @default(uuid())
  organizationId  String?             // null for system-level calls
  agentName       String              // Which agent made the call
  pipelineId      String?             // Which pipeline this was part of

  // Request
  requestTier     String              // "budget", "mid", "flagship" (classified)
  taskType        String              // "classification", "generation", "analysis", etc.

  // Model used
  providerId      String
  providerName    String
  modelId         String
  modelDisplayName String

  // Tokens
  inputTokens     Int
  outputTokens    Int
  cachedTokens    Int      @default(0)
  totalTokens     Int

  // Cost (in USD cents)
  inputCost       Int                 // Calculated from model pricing × tokens
  outputCost      Int
  cacheSavings    Int      @default(0) // How much saved by caching
  totalCost       Int                 // inputCost + outputCost - cacheSavings

  // Performance
  latencyMs       Int
  wasRetry        Boolean  @default(false)
  wasFallback     Boolean  @default(false) // Used fallback provider
  originalModelId String?              // If fallback, what was the first choice

  // Response quality (optional — filled by Self-Evaluation system)
  qualityScore    Float?              // 0-1 if we have a way to evaluate

  success         Boolean  @default(true)
  errorMessage    String?
  createdAt       DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([agentName, createdAt])
  @@index([providerId, modelId, createdAt])
  @@index([requestTier, createdAt])
  @@index([createdAt])
}

// ════════════════════════════════════════════════════════
// DAILY COST AGGREGATION (for dashboard performance)
// ════════════════════════════════════════════════════════

model DailyCostSummary {
  id              String   @id @default(uuid())
  date            DateTime @db.Date
  organizationId  String?             // null = platform-wide

  totalCalls      Int
  totalInputTokens  BigInt
  totalOutputTokens BigInt
  totalCostCents  Int                 // Total cost in USD cents

  // Breakdown by tier
  budgetCalls     Int      @default(0)
  budgetCost      Int      @default(0)
  midCalls        Int      @default(0)
  midCost         Int      @default(0)
  flagshipCalls   Int      @default(0)
  flagshipCost    Int      @default(0)

  // Breakdown by provider
  costByProvider  Json                // { "anthropic": 4523, "openai": 1200, "google": 340 }

  // Breakdown by agent
  costByAgent     Json                // { "CONTENT_CREATOR": 2100, "ENGAGEMENT": 1800, ... }

  createdAt       DateTime @default(now())

  @@unique([date, organizationId])
  @@index([date])
  @@index([organizationId, date])
}
```

---

## Request Complexity Classifier

```typescript
// lib/router/classifier.ts

// The classifier determines which tier a request should use.
// It does NOT call an LLM — it uses fast rule-based classification.

type RequestTier = "budget" | "mid" | "flagship";
type TaskType =
  | "classification"      // Yes/no, category assignment, sentiment
  | "extraction"          // Pull structured data from text
  | "moderation"          // Content safety check
  | "translation"         // Language translation
  | "summarization"       // Condense text
  | "rewriting"           // Rephrase/edit existing text
  | "generation"          // Create new content (captions, posts)
  | "conversation"        // Multi-turn dialogue (Talk to AI)
  | "analysis"            // Deep analysis, insights, patterns
  | "reasoning"           // Complex logic, strategy, planning
  | "coding"              // Code generation or modification
  | "vision"              // Image understanding
  | "structured_output";  // Complex JSON schema generation

interface ClassificationResult {
  tier: RequestTier;
  taskType: TaskType;
  confidence: number;
  reason: string;
}

// Agent → default task type mapping (each agent knows its primary task)
const AGENT_TASK_MAP: Record<string, TaskType> = {
  // BUDGET tier agents (classification, extraction, moderation)
  COMPLIANCE:               "classification",
  HASHTAG_OPTIMIZER:        "extraction",
  CALENDAR_OPTIMIZER:       "extraction",
  CONTENT_REPLENISHMENT:    "classification",

  // MID tier agents (generation, summarization, rewriting)
  CONTENT_CREATOR:          "generation",
  ENGAGEMENT:               "generation",
  CAPTION_REWRITER:         "rewriting",
  REPURPOSE:                "rewriting",
  LOCALIZATION:             "translation",
  REVIEW_RESPONSE:          "generation",
  AD_COPY:                  "generation",
  REPORTING_NARRATOR:       "summarization",
  SOCIAL_SEO:               "extraction",
  HASHTAG_OPTIMIZER:        "extraction",
  BRAND_VOICE_GUARDIAN:     "classification",
  UGC_CURATOR:              "classification",

  // FLAGSHIP tier agents (analysis, reasoning, strategy)
  STRATEGY:                 "reasoning",
  PREDICTIVE_CONTENT:       "analysis",
  SENTIMENT_INTELLIGENCE:   "analysis",
  AUDIENCE_INTELLIGENCE:    "analysis",
  COMPETITOR_INTELLIGENCE:  "analysis",
  COMPETITIVE_AD_INTELLIGENCE: "analysis",
  CROSS_CHANNEL_ATTRIBUTION: "analysis",
  ROI_ATTRIBUTION:          "analysis",
  PRICING_INTELLIGENCE:     "analysis",
  COMMUNITY_BUILDER:        "analysis",
  MEDIA_PITCH:              "generation",
  INFLUENCER_SCOUT:         "analysis",
  CRISIS_RESPONSE:          "reasoning",
  CHURN_PREDICTION:         "analysis",
  TREND_SCOUT:              "extraction",
  SOCIAL_LISTENING:         "classification",
  ONBOARDING_INTELLIGENCE:  "analysis",
};

// Task type → default tier mapping
const TASK_TIER_MAP: Record<TaskType, RequestTier> = {
  classification:     "budget",
  extraction:         "budget",
  moderation:         "budget",
  translation:        "mid",
  summarization:      "mid",
  rewriting:          "mid",
  generation:         "mid",
  conversation:       "mid",
  analysis:           "flagship",
  reasoning:          "flagship",
  coding:             "flagship",
  vision:             "mid",
  structured_output:  "mid",
};

function classifyRequest(params: {
  agentName: string;
  taskType?: TaskType;          // Agent can explicitly declare
  inputTokenEstimate?: number;  // Larger inputs may need larger models
  requiresVision?: boolean;
  requiresToolUse?: boolean;
  requiresJson?: boolean;
}): ClassificationResult {
  // 1. If agent explicitly declares task type, use it
  const taskType = params.taskType ?? AGENT_TASK_MAP[params.agentName] ?? "generation";

  // 2. Map task type to tier
  let tier = TASK_TIER_MAP[taskType];

  // 3. Adjustments based on request characteristics
  // Large context → may need model with bigger context window (doesn't change tier, handled in resolver)
  // Vision required → filter to vision-capable models (handled in resolver)
  // Tool use required → filter to tool-use-capable models (handled in resolver)

  // 4. Some agents have sub-tasks at different tiers:
  // ENGAGEMENT agent's "classify comment" sub-call = budget
  // ENGAGEMENT agent's "draft response" sub-call = mid
  // CONTENT_CREATOR's "generate caption" = mid
  // CONTENT_CREATOR's "generate full strategy" = flagship
  // This is handled by the agent passing taskType explicitly for sub-calls

  return {
    tier,
    taskType,
    confidence: params.taskType ? 1.0 : 0.85, // Higher confidence if agent declared type
    reason: `Agent ${params.agentName} → task ${taskType} → tier ${tier}`,
  };
}
```

---

## Model Resolver

```typescript
// lib/router/resolver.ts

interface ResolvedModel {
  provider: LLMProvider;
  model: LLMModel;
  fallbacks: Array<{ provider: LLMProvider; model: LLMModel }>;
}

async function resolveModel(params: {
  tier: RequestTier;
  taskType: TaskType;
  agentName: string;
  requiresVision?: boolean;
  requiresToolUse?: boolean;
  requiresJson?: boolean;
  minContextWindow?: number;
}): Promise<ResolvedModel> {

  // 1. Check for explicit routing rules first
  const rule = await prisma.routingRule.findFirst({
    where: {
      isActive: true,
      OR: [
        { matchAgent: params.agentName },
        { matchTaskType: params.taskType },
        { matchTier: params.tier },
      ],
    },
    include: { targetModel: { include: { provider: true } } },
    orderBy: { priority: "desc" },
  });

  if (rule?.targetModel?.isActive && rule.targetModel.provider.isActive) {
    const fallbacks = await getFallbacks(rule.overrideTier ?? params.tier, params, rule.targetModel.id);
    return {
      provider: rule.targetModel.provider,
      model: rule.targetModel,
      fallbacks,
    };
  }

  // 2. Find best model for this tier
  const candidates = await prisma.lLMModel.findMany({
    where: {
      isActive: true,
      tier: params.tier,
      provider: { isActive: true, healthStatus: { not: "down" } },
      ...(params.requiresVision ? { supportsImages: true } : {}),
      ...(params.requiresToolUse ? { supportsToolUse: true } : {}),
      ...(params.requiresJson ? { supportsJson: true } : {}),
      ...(params.minContextWindow ? { maxInputTokens: { gte: params.minContextWindow } } : {}),
    },
    include: { provider: true },
    orderBy: [
      { priorityInTier: "asc" },   // Lower priority number = preferred
      { inputPricePer1M: "asc" },   // Then by price
    ],
  });

  if (candidates.length === 0) {
    // No model in this tier meets requirements — try upgrading tier
    const upgradedTier = params.tier === "budget" ? "mid" : "flagship";
    return resolveModel({ ...params, tier: upgradedTier });
  }

  // 3. Pick primary (first candidate) and build fallback chain
  const primary = candidates[0];
  const fallbacks = candidates.slice(1).map(m => ({
    provider: m.provider,
    model: m,
  }));

  return {
    provider: primary.provider,
    model: primary,
    fallbacks,
  };
}

async function getFallbacks(
  tier: string,
  params: any,
  excludeModelId: string,
): Promise<Array<{ provider: LLMProvider; model: LLMModel }>> {
  const fallbackModels = await prisma.lLMModel.findMany({
    where: {
      isActive: true,
      tier,
      id: { not: excludeModelId },
      provider: { isActive: true, healthStatus: { not: "down" } },
      ...(params.requiresVision ? { supportsImages: true } : {}),
      ...(params.requiresToolUse ? { supportsToolUse: true } : {}),
    },
    include: { provider: true },
    orderBy: { priorityInTier: "asc" },
    take: 3,
  });

  return fallbackModels.map(m => ({ provider: m.provider, model: m }));
}
```

---

## Provider Adapters

```typescript
// lib/router/providers/base.ts

interface LLMRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | any[] }>;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
  responseFormat?: { type: "json_object" } | { type: "text" };
  stream?: boolean;
}

interface LLMResponse {
  content: string;
  toolCalls?: any[];
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  finishReason: string;
  raw: any;               // Raw provider response for debugging
}

interface ProviderAdapter {
  name: string;
  execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}
```

```typescript
// lib/router/providers/anthropic.ts

import Anthropic from "@anthropic-ai/sdk";

export class AnthropicAdapter implements ProviderAdapter {
  name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new Anthropic({ apiKey, baseURL: baseUrl });
  }

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const systemMessage = request.messages.find(m => m.role === "system");
    const nonSystemMessages = request.messages.filter(m => m.role !== "system");

    const params: Anthropic.MessageCreateParams = {
      model: model.modelId,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      messages: nonSystemMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    };

    if (systemMessage) {
      params.system = typeof systemMessage.content === "string"
        ? systemMessage.content
        : systemMessage.content;
    }

    if (request.tools?.length) {
      params.tools = request.tools;
    }

    const response = await this.client.messages.create(params);

    const textBlock = response.content.find(b => b.type === "text");
    const toolBlocks = response.content.filter(b => b.type === "tool_use");

    return {
      content: textBlock?.text ?? "",
      toolCalls: toolBlocks.length > 0 ? toolBlocks : undefined,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedTokens: response.usage.cache_read_input_tokens ?? 0,
      finishReason: response.stop_reason ?? "end_turn",
      raw: response,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// lib/router/providers/openai.ts

import OpenAI from "openai";

export class OpenAIAdapter implements ProviderAdapter {
  name = "openai";
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const params: OpenAI.ChatCompletionCreateParams = {
      model: model.modelId,
      max_completion_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (request.tools?.length) {
      // Convert from Anthropic tool format to OpenAI function format
      params.tools = request.tools.map(t => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    if (request.responseFormat?.type === "json_object") {
      params.response_format = { type: "json_object" };
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];

    return {
      content: choice.message.content ?? "",
      toolCalls: choice.message.tool_calls?.map(tc => ({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      })),
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      cachedTokens: response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      finishReason: choice.finish_reason ?? "stop",
      raw: response,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// lib/router/providers/google.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GoogleAdapter implements ProviderAdapter {
  name = "google";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const genModel = this.client.getGenerativeModel({ model: model.modelId });

    const systemMessage = request.messages.find(m => m.role === "system");
    const chatMessages = request.messages.filter(m => m.role !== "system");

    // Convert to Gemini format
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    const chat = genModel.startChat({
      history,
      systemInstruction: systemMessage
        ? { parts: [{ text: typeof systemMessage.content === "string" ? systemMessage.content : JSON.stringify(systemMessage.content) }] }
        : undefined,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        ...(request.responseFormat?.type === "json_object" ? { responseMimeType: "application/json" } : {}),
      },
    });

    const result = await chat.sendMessage(
      typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content)
    );

    const response = result.response;
    const usage = response.usageMetadata;

    return {
      content: response.text() ?? "",
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      cachedTokens: usage?.cachedContentTokenCount ?? 0,
      finishReason: response.candidates?.[0]?.finishReason ?? "STOP",
      raw: response,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });
      await model.generateContent("ping");
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## Provider Registry

```typescript
// lib/router/providers/registry.ts

// Initialized once at app startup, refreshed when admin changes provider settings

class ProviderRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();

  async initialize() {
    const providers = await prisma.lLMProvider.findMany({ where: { isActive: true } });

    for (const provider of providers) {
      const apiKey = process.env[provider.apiKeyEnvVar];
      if (!apiKey) {
        console.warn(`Missing API key for provider ${provider.name} (env: ${provider.apiKeyEnvVar})`);
        continue;
      }

      switch (provider.name) {
        case "anthropic":
          this.adapters.set(provider.id, new AnthropicAdapter(apiKey, provider.baseUrl ?? undefined));
          break;
        case "openai":
          this.adapters.set(provider.id, new OpenAIAdapter(apiKey, provider.baseUrl ?? undefined));
          break;
        case "google":
          this.adapters.set(provider.id, new GoogleAdapter(apiKey));
          break;
        // Extensible: add new providers here
        default:
          console.warn(`Unknown provider type: ${provider.name}`);
      }
    }
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  async refreshProvider(providerId: string) {
    // Called when admin updates a provider
    const provider = await prisma.lLMProvider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isActive) {
      this.adapters.delete(providerId);
      return;
    }
    // Re-initialize just this provider
    const apiKey = process.env[provider.apiKeyEnvVar];
    if (!apiKey) return;

    switch (provider.name) {
      case "anthropic":
        this.adapters.set(provider.id, new AnthropicAdapter(apiKey, provider.baseUrl ?? undefined));
        break;
      case "openai":
        this.adapters.set(provider.id, new OpenAIAdapter(apiKey, provider.baseUrl ?? undefined));
        break;
      case "google":
        this.adapters.set(provider.id, new GoogleAdapter(apiKey));
        break;
    }
  }
}

export const providerRegistry = new ProviderRegistry();
```

---

## SmartRouter (Main API)

```typescript
// lib/router/index.ts

export interface SmartRouterRequest {
  // Who is calling
  organizationId?: string;
  agentName: string;
  pipelineId?: string;

  // Task classification hints
  taskType?: TaskType;          // Let agent declare if known
  forceModel?: string;          // Skip routing, use this model ID
  forceTier?: RequestTier;      // Skip classifier, use this tier
  preferProvider?: string;      // Prefer this provider if available

  // LLM request
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | any[] }>;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
  responseFormat?: { type: "json_object" } | { type: "text" };

  // Requirements
  requiresVision?: boolean;
  requiresToolUse?: boolean;
  requiresJson?: boolean;
  minContextWindow?: number;
}

export interface SmartRouterResponse {
  content: string;
  toolCalls?: any[];
  inputTokens: number;
  outputTokens: number;

  // Routing metadata
  tier: RequestTier;
  taskType: TaskType;
  providerName: string;
  modelId: string;
  modelDisplayName: string;
  costCents: number;            // Total cost in USD cents
  latencyMs: number;
  wasFallback: boolean;
}

export const smartRouter = {

  async complete(request: SmartRouterRequest): Promise<SmartRouterResponse> {
    const startTime = Date.now();

    // 1. CLASSIFY
    const classification = request.forceTier
      ? { tier: request.forceTier, taskType: request.taskType ?? "generation", confidence: 1, reason: "forced" }
      : classifyRequest({
          agentName: request.agentName,
          taskType: request.taskType,
          requiresVision: request.requiresVision,
          requiresToolUse: request.requiresToolUse,
        });

    // 2. RESOLVE MODEL
    let resolved: ResolvedModel;
    if (request.forceModel) {
      const model = await prisma.lLMModel.findFirst({
        where: { modelId: request.forceModel, isActive: true },
        include: { provider: true },
      });
      if (!model) throw new Error(`Forced model ${request.forceModel} not found or inactive`);
      resolved = { provider: model.provider, model, fallbacks: [] };
    } else {
      resolved = await resolveModel({
        tier: classification.tier,
        taskType: classification.taskType,
        agentName: request.agentName,
        requiresVision: request.requiresVision,
        requiresToolUse: request.requiresToolUse,
        requiresJson: request.requiresJson,
        minContextWindow: request.minContextWindow,
      });
    }

    // 3. EXECUTE (with fallback)
    let response: LLMResponse;
    let usedModel = resolved.model;
    let usedProvider = resolved.provider;
    let wasFallback = false;
    let originalModelId: string | undefined;

    try {
      const adapter = providerRegistry.get(resolved.provider.id);
      if (!adapter) throw new Error(`No adapter for provider ${resolved.provider.name}`);
      response = await adapter.execute(resolved.model, {
        messages: request.messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        tools: request.tools,
        responseFormat: request.responseFormat,
      });
    } catch (primaryError) {
      // Try fallbacks
      originalModelId = resolved.model.modelId;
      let lastError = primaryError;

      for (const fallback of resolved.fallbacks) {
        try {
          const adapter = providerRegistry.get(fallback.provider.id);
          if (!adapter) continue;
          response = await adapter.execute(fallback.model, {
            messages: request.messages,
            maxTokens: request.maxTokens,
            temperature: request.temperature,
            tools: request.tools,
            responseFormat: request.responseFormat,
          });
          usedModel = fallback.model;
          usedProvider = fallback.provider;
          wasFallback = true;
          break;
        } catch (fallbackError) {
          lastError = fallbackError;
          continue;
        }
      }

      if (!response!) {
        // All providers failed — log and throw
        await logUsageFailure(request, classification, usedModel, lastError);
        throw lastError;
      }
    }

    const latencyMs = Date.now() - startTime;

    // 4. CALCULATE COST
    const inputCost = Math.ceil((response.inputTokens / 1_000_000) * usedModel.inputPricePer1M);
    const outputCost = Math.ceil((response.outputTokens / 1_000_000) * usedModel.outputPricePer1M);
    const cacheSavings = usedModel.cachedInputPricePer1M
      ? Math.ceil((response.cachedTokens / 1_000_000) * (usedModel.inputPricePer1M - usedModel.cachedInputPricePer1M))
      : 0;
    const totalCost = inputCost + outputCost - cacheSavings;

    // 5. LOG USAGE
    await prisma.lLMUsageLog.create({
      data: {
        organizationId: request.organizationId,
        agentName: request.agentName,
        pipelineId: request.pipelineId,
        requestTier: classification.tier,
        taskType: classification.taskType,
        providerId: usedProvider.id,
        providerName: usedProvider.name,
        modelId: usedModel.modelId,
        modelDisplayName: usedModel.displayName,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cachedTokens: response.cachedTokens,
        totalTokens: response.inputTokens + response.outputTokens,
        inputCost,
        outputCost,
        cacheSavings,
        totalCost,
        latencyMs,
        wasRetry: false,
        wasFallback,
        originalModelId,
        success: true,
      },
    });

    return {
      content: response.content,
      toolCalls: response.toolCalls,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      tier: classification.tier,
      taskType: classification.taskType,
      providerName: usedProvider.name,
      modelId: usedModel.modelId,
      modelDisplayName: usedModel.displayName,
      costCents: totalCost,
      latencyMs,
      wasFallback,
    };
  },
};
```

---

## BaseAgent Integration

```typescript
// Modify BaseAgent to use SmartRouter instead of direct Anthropic calls:

abstract class BaseAgent {
  abstract agentName: string;
  abstract taskType: TaskType;        // Each agent declares its primary task type
  abstract forceTier?: RequestTier;   // Optional: force a specific tier

  async callLLM(params: {
    organizationId: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
    tools?: any[];
    responseFormat?: any;
    taskTypeOverride?: TaskType;      // For sub-calls at different complexity
    pipelineId?: string;
  }): Promise<SmartRouterResponse> {
    return smartRouter.complete({
      organizationId: params.organizationId,
      agentName: this.agentName,
      taskType: params.taskTypeOverride ?? this.taskType,
      forceTier: this.forceTier,
      pipelineId: params.pipelineId,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      maxTokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.7,
      tools: params.tools,
      responseFormat: params.responseFormat,
      requiresToolUse: !!params.tools?.length,
      requiresJson: !!params.responseFormat,
    });
  }
}

// Example: Engagement Agent has two task types
class EngagementAgent extends BaseAgent {
  agentName = "ENGAGEMENT";
  taskType: TaskType = "classification"; // Default: classifying comments

  async run(organizationId: string) {
    // Step 1: Classify comments (budget tier)
    const classified = await this.callLLM({
      organizationId,
      systemPrompt: "Classify these comments as positive/negative/question/complaint...",
      userPrompt: commentsBatch,
      taskTypeOverride: "classification", // → routes to budget model
    });

    // Step 2: Draft responses for important comments (mid tier)
    const responses = await this.callLLM({
      organizationId,
      systemPrompt: "Draft a friendly response to this customer comment...",
      userPrompt: importantComments,
      taskTypeOverride: "generation", // → routes to mid-tier model
    });
  }
}
```

---

## Daily Aggregation (Orchestrator)

```typescript
// Runs daily at 1am — aggregates raw usage logs into daily summaries

export const aggregateDailyCosts = inngest.createFunction(
  { id: "aggregate-daily-costs" },
  { cron: "0 1 * * *" },
  async ({ step }) => {
    const yesterday = startOfDay(subDays(new Date(), 1));

    // Platform-wide summary
    await step.run("platform-summary", async () => {
      const logs = await prisma.lLMUsageLog.groupBy({
        by: ["requestTier", "providerName", "agentName"],
        where: { createdAt: { gte: yesterday, lt: addDays(yesterday, 1) } },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true, totalCost: true },
      });

      const costByProvider: Record<string, number> = {};
      const costByAgent: Record<string, number> = {};
      let budgetCalls = 0, budgetCost = 0;
      let midCalls = 0, midCost = 0;
      let flagshipCalls = 0, flagshipCost = 0;

      for (const group of logs) {
        costByProvider[group.providerName] = (costByProvider[group.providerName] ?? 0) + (group._sum.totalCost ?? 0);
        costByAgent[group.agentName] = (costByAgent[group.agentName] ?? 0) + (group._sum.totalCost ?? 0);

        switch (group.requestTier) {
          case "budget":
            budgetCalls += group._count;
            budgetCost += group._sum.totalCost ?? 0;
            break;
          case "mid":
            midCalls += group._count;
            midCost += group._sum.totalCost ?? 0;
            break;
          case "flagship":
            flagshipCalls += group._count;
            flagshipCost += group._sum.totalCost ?? 0;
            break;
        }
      }

      await prisma.dailyCostSummary.upsert({
        where: { date_organizationId: { date: yesterday, organizationId: null } },
        update: {
          totalCalls: budgetCalls + midCalls + flagshipCalls,
          totalCostCents: budgetCost + midCost + flagshipCost,
          budgetCalls, budgetCost, midCalls, midCost, flagshipCalls, flagshipCost,
          costByProvider, costByAgent,
        },
        create: {
          date: yesterday,
          organizationId: null,
          totalCalls: budgetCalls + midCalls + flagshipCalls,
          totalInputTokens: BigInt(logs.reduce((s, g) => s + (g._sum.inputTokens ?? 0), 0)),
          totalOutputTokens: BigInt(logs.reduce((s, g) => s + (g._sum.outputTokens ?? 0), 0)),
          totalCostCents: budgetCost + midCost + flagshipCost,
          budgetCalls, budgetCost, midCalls, midCost, flagshipCalls, flagshipCost,
          costByProvider, costByAgent,
        },
      });
    });

    // Per-org summaries
    await step.run("per-org-summaries", async () => {
      const orgGroups = await prisma.lLMUsageLog.groupBy({
        by: ["organizationId"],
        where: {
          createdAt: { gte: yesterday, lt: addDays(yesterday, 1) },
          organizationId: { not: null },
        },
        _count: true,
        _sum: { totalCost: true, inputTokens: true, outputTokens: true },
      });

      for (const og of orgGroups) {
        if (!og.organizationId) continue;
        await prisma.dailyCostSummary.upsert({
          where: { date_organizationId: { date: yesterday, organizationId: og.organizationId } },
          update: {
            totalCalls: og._count,
            totalCostCents: og._sum.totalCost ?? 0,
          },
          create: {
            date: yesterday,
            organizationId: og.organizationId,
            totalCalls: og._count,
            totalInputTokens: BigInt(og._sum.inputTokens ?? 0),
            totalOutputTokens: BigInt(og._sum.outputTokens ?? 0),
            totalCostCents: og._sum.totalCost ?? 0,
            costByProvider: {},
            costByAgent: {},
          },
        });
      }
    });
  }
);
```

---

## Provider Health Monitoring

```typescript
// Runs every 5 minutes — checks provider health

export const healthCheck = inngest.createFunction(
  { id: "router-health-check" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const providers = await prisma.lLMProvider.findMany({ where: { isActive: true } });

    for (const provider of providers) {
      await step.run(`health-${provider.name}`, async () => {
        const adapter = providerRegistry.get(provider.id);
        if (!adapter) return;

        const isHealthy = await adapter.healthCheck();
        const newStatus = isHealthy ? "healthy" : "degraded";

        if (newStatus !== provider.healthStatus) {
          await prisma.lLMProvider.update({
            where: { id: provider.id },
            data: { healthStatus: newStatus, lastHealthCheck: new Date() },
          });

          if (!isHealthy) {
            // Log for admin visibility
            console.warn(`[SmartRouter] Provider ${provider.name} is ${newStatus}`);
          }
        }
      });
    }
  }
);
```

---

## Super Admin: Model Management UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🤖 LLM Model Management                                    [+ Provider]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌── ANTHROPIC ──────────────────────────────────── 🟢 Healthy ────────┐ │
│ │ API Key: ANTHROPIC_API_KEY ✅ Set                                   │ │
│ │                                                                      │ │
│ │ Model             │ Tier     │ Input/1M  │ Output/1M │ Priority │ ✅│ │
│ │───────────────────┼──────────┼───────────┼───────────┼──────────┼───│ │
│ │ Claude Haiku 4.5  │ budget   │ $1.00     │ $5.00     │ 1        │ ✅│ │
│ │ Claude Sonnet 4.5 │ mid      │ $3.00     │ $15.00    │ 1        │ ✅│ │
│ │ Claude Opus 4.5   │ flagship │ $15.00    │ $75.00    │ 1        │ ✅│ │
│ │                                                                      │ │
│ │ [+ Add Model]                                                        │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌── OPENAI ─────────────────────────────────────── 🟢 Healthy ────────┐ │
│ │ API Key: OPENAI_API_KEY ✅ Set                                      │ │
│ │                                                                      │ │
│ │ Model             │ Tier     │ Input/1M  │ Output/1M │ Priority │ ✅│ │
│ │───────────────────┼──────────┼───────────┼───────────┼──────────┼───│ │
│ │ GPT-4o Mini       │ budget   │ $0.15     │ $0.60     │ 2        │ ✅│ │
│ │ GPT-4o            │ mid      │ $2.50     │ $10.00    │ 2        │ ✅│ │
│ │ o3                │ flagship │ $10.00    │ $40.00    │ 2        │ ✅│ │
│ │                                                                      │ │
│ │ [+ Add Model]                                                        │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌── GOOGLE ─────────────────────────────────────── 🟢 Healthy ────────┐ │
│ │ API Key: GOOGLE_AI_API_KEY ✅ Set                                   │ │
│ │                                                                      │ │
│ │ Model             │ Tier     │ Input/1M  │ Output/1M │ Priority │ ✅│ │
│ │───────────────────┼──────────┼───────────┼───────────┼──────────┼───│ │
│ │ Gemini 2.0 Flash  │ budget   │ $0.10     │ $0.40     │ 3        │ ✅│ │
│ │ Gemini 2.5 Pro    │ mid      │ $1.25     │ $10.00    │ 3        │ ✅│ │
│ │ Gemini 2.5 Pro    │ flagship │ $1.25     │ $10.00    │ 3        │ ☐│ │
│ │                                                                      │ │
│ │ [+ Add Model]                                                        │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ ┌── ROUTING RULES ────────────────────────────────────── [+ New Rule] ─┐ │
│ │                                                                      │ │
│ │ Rule                          │ Match            │ Route To    │ ✅  │ │
│ │───────────────────────────────┼──────────────────┼─────────────┼──── │ │
│ │ Content Creator → Sonnet      │ Agent: CONTENT.. │ Sonnet 4.5  │ ✅  │ │
│ │ Strategy always flagship      │ Agent: STRATEGY  │ Opus 4.5    │ ✅  │ │
│ │ Compliance → cheapest         │ Task: classific..│ Gemini Flash│ ✅  │ │
│ │ Talk to AI → Sonnet           │ Agent: TALK_AI   │ Sonnet 4.5  │ ✅  │ │
│ │                                                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Model Edit Form

```
┌──────────────────────────────────────────────────────────────┐
│ Edit Model: Claude Sonnet 4.5                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Provider:     Anthropic (cannot change)                      │
│ Model ID:     [claude-sonnet-4-5-20250929          ]         │
│ Display Name: [Claude Sonnet 4.5                    ]        │
│ Tier:         ○ Budget  ● Mid  ○ Flagship                   │
│ ☑ Active                                                     │
│                                                              │
│ ── Pricing (per 1M tokens, in USD) ────────────────          │
│ Input price:       [$3.00        ]                           │
│ Output price:      [$15.00       ]                           │
│ Cached input price:[$0.30        ] (leave blank if N/A)      │
│                                                              │
│ ── Capabilities ────────────────────────────────────          │
│ ☑ Classification  ☑ Extraction  ☑ Generation                 │
│ ☑ Reasoning       ☑ Analysis    ☑ Coding                     │
│ ☑ Vision          ☑ Tool Use    ☑ JSON Mode                  │
│ ☑ Streaming       ☑ Caching                                  │
│                                                              │
│ ── Limits ──────────────────────────────────────────          │
│ Max input tokens:  [200000       ]                           │
│ Max output tokens: [8192         ]                           │
│                                                              │
│ ── Routing ─────────────────────────────────────────          │
│ Priority in tier:  [1            ] (lower = preferred)       │
│                                                              │
│ [Save]  [Cancel]                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Super Admin: Cost Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 💰 LLM Cost Dashboard                           [Today] [Week] [Month] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ TOTAL COST   │  │ TOTAL CALLS  │  │ AVG/CALL     │  │ SAVINGS     │ │
│  │ $342.18      │  │ 187,432      │  │ $0.0018      │  │ vs flagship │ │
│  │ this month   │  │ this month   │  │              │  │ -62% 🟢     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                          │
│  ┌─── COST BY TIER ──────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Budget (72% of calls)  ████░░░░░░░░░░░░  $48.23  (14%)          │  │
│  │  Mid    (21% of calls)  ████████████░░░░  $178.92 (52%)          │  │
│  │  Flagship (7% of calls) █████████████████  $115.03 (34%)          │  │
│  │                                                                    │  │
│  │  Routing efficiency: 72/21/7 (target: 70/20/10) ✅ On track      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── COST BY PROVIDER ──────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Anthropic  █████████████████████  $231.45  (68%)                 │  │
│  │  OpenAI     ██████░░░░░░░░░░░░░░  $67.23   (20%)                 │  │
│  │  Google     ████░░░░░░░░░░░░░░░░  $43.50   (12%)                 │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── TOP 10 COSTLIEST AGENTS ──────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  1. ENGAGEMENT        $67.23  (19.6%)  3,480 calls  budget       │  │
│  │  2. CONTENT_CREATOR   $52.10  (15.2%)    780 calls  mid          │  │
│  │  3. STRATEGY          $34.56  (10.1%)     31 calls  flagship     │  │
│  │  4. SOCIAL_LISTENING  $28.90   (8.4%)  1,440 calls  budget       │  │
│  │  5. COMPETITOR_INTEL  $22.34   (6.5%)    300 calls  flagship     │  │
│  │  ...                                                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── PROFITABILITY BY CLIENT ───────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Client        │ Plan    │ Revenue │ AI Cost │ Margin │ Status    │  │
│  │  ──────────────┼─────────┼─────────┼─────────┼────────┼────────── │  │
│  │  PureGlow      │ Growth  │ $399    │ $68.23  │ 82.9%  │ 🟢       │  │
│  │  TechStartup   │ Pro     │ $799    │ $124.56 │ 84.4%  │ 🟢       │  │
│  │  FoodiesCo     │ Starter │ $199    │ $89.12  │ 55.2%  │ 🟡       │  │
│  │  StyleHouse    │ Growth  │ $399    │ $167.34 │ 58.1%  │ 🟡       │  │
│  │  AgencyX       │ Agency  │ $1,495  │ $345.67 │ 76.9%  │ 🟢       │  │
│  │  ──────────────┼─────────┼─────────┼─────────┼────────┼────────── │  │
│  │  PLATFORM      │ Total   │ $3,291  │ $794.92 │ 75.8%  │ 🟢       │  │
│  │                                                                    │  │
│  │  ⚠️ FoodiesCo and StyleHouse below 60% margin — high engagement  │  │
│  │     volume. Consider optimizing engagement agent caching.          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── DAILY COST TREND ─────────────────────────────────────────────┐  │
│  │  $25 ┤                                                            │  │
│  │      │          ╱\                                                │  │
│  │  $20 ┤     ╱──╱  ╲──╱\                                           │  │
│  │      │   ╱╱           ╲╲                                          │  │
│  │  $15 ┤──╱               ╲──╱──╲──╱──                             │  │
│  │      │                                                            │  │
│  │  $10 ┤                                                            │  │
│  │      ├────┬────┬────┬────┬────┬────┬────                          │  │
│  │      Mon  Tue  Wed  Thu  Fri  Sat  Sun                            │  │
│  │                                                                    │  │
│  │  ── Budget  ── Mid  ── Flagship                                   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── FALLBACK REPORT ──────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │  Fallbacks triggered: 23 this month (0.01% of calls)              │  │
│  │  Primary failures: Anthropic 15, OpenAI 6, Google 2               │  │
│  │  All recovered via fallback — zero unrecoverable failures ✅       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Suggested Initial Model Configuration

This is what the admin UI should be seeded with. All values editable from UI — this is just the starting point:

```
BUDGET TIER (classification, extraction, moderation):
├── Gemini 2.0 Flash      — $0.10 in / $0.40 out  — Priority 1 (cheapest)
├── GPT-4o Mini            — $0.15 in / $0.60 out  — Priority 2
└── Claude Haiku 4.5       — $1.00 in / $5.00 out  — Priority 3

MID TIER (generation, summarization, rewriting):
├── Claude Sonnet 4.5      — $3.00 in / $15.00 out — Priority 1 (best quality/price)
├── GPT-4o                 — $2.50 in / $10.00 out — Priority 2
└── Gemini 2.5 Pro         — $1.25 in / $10.00 out — Priority 3

FLAGSHIP TIER (reasoning, analysis, strategy):
├── Claude Opus 4.5        — $15.00 in / $75.00 out — Priority 1 (best reasoning)
├── o3                     — $10.00 in / $40.00 out — Priority 2
└── Gemini 2.5 Pro         — $1.25 in / $10.00 out  — Priority 3 (value option)
```

With this configuration and the 70/20/10 split, estimated blended cost per 1M tokens:
- Budget: ~$0.25 (weighted avg)
- Mid: ~$9.00 (weighted avg)
- Flagship: ~$45.00 (weighted avg)
- **Blended: ~$6.13 per 1M tokens** (vs $15.00 if everything ran on Sonnet = **59% savings**)

---

## Rules

1. **Every LLM call in the entire platform goes through `smartRouter.complete()`.** No direct provider SDK calls anywhere in agent code.
2. **Zero hardcoded prices.** All model pricing is in the database, managed from admin UI. When providers update pricing, admin updates one screen.
3. **Zero hardcoded model IDs in agent code.** Agents declare task type and tier. SmartRouter resolves the model.
4. **Fallback is automatic.** If Anthropic is down, requests automatically route to the next provider in the same tier. Agents don't know or care.
5. **Cost tracking is per-call.** Every single LLM call logs tokens, model, cost, org, agent. This data feeds the admin cost dashboard and per-client profitability view.
6. **Routing rules are admin-managed.** If the admin decides "Content Creator should always use Sonnet regardless of default tier," they add a routing rule. No code change.
7. **Health checks run every 5 minutes.** Degraded providers get deprioritized automatically. Down providers are skipped entirely.
8. **Daily aggregation keeps the dashboard fast.** Raw logs for detailed analysis, daily summaries for dashboard charts.
9. **Agent sub-calls can declare different task types.** The Engagement agent can classify comments on budget tier and draft responses on mid tier in the same execution.
10. **Profitability monitoring is mandatory.** The admin dashboard shows per-client margin. If a client's AI cost exceeds 50% of their plan price, flag it.
