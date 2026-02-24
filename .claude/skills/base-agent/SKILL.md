---
name: base-agent
description: "Foundation for all AI agents: BaseAgent class, logging, confidence scoring, escalation pipeline, cost tracking. READ THIS FIRST before any agent work."
---

# SKILL: Base Agent Pattern

> Read this skill FIRST before implementing any agent. Every agent in the system extends this base pattern. No exceptions.

---

## Purpose

Defines the foundational class, logging contract, confidence scoring, escalation pipeline, and cost tracking that every AI agent must inherit. If you're building a new agent, you implement `execute()` — the base handles everything else.

---

## Architecture Overview

```
BaseAgent (abstract)
├── run()              → Wraps execute() with logging, timing, error handling, escalation
├── execute()          → ABSTRACT — each agent implements this
├── escalate()         → Creates escalation record + sends notifications
├── log()              → Writes to agent_logs table
└── estimateCost()     → Calculates token cost for tracking
```

Every agent call flows through `run()`, never `execute()` directly.

---

## File Location

```
agents/shared/base-agent.ts       ← The base class
agents/shared/confidence.ts       ← Confidence scoring utilities
agents/shared/escalation.ts       ← Escalation logic and notification
agents/shared/logger.ts           ← Agent audit log utilities
```

---

## Implementation

### Base Class

```typescript
// agents/shared/base-agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { AgentName, AgentLogStatus } from "@prisma/client";

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  confidenceScore: number;       // 0.0 – 1.0, mandatory
  shouldEscalate: boolean;
  escalationReason?: string;
  tokensUsed: number;
}

export abstract class BaseAgent {
  protected client: Anthropic;
  protected agentName: AgentName;
  protected model: string;

  constructor(agentName: AgentName, model = "claude-sonnet-4-20250514") {
    this.agentName = agentName;
    this.model = model;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }

  /** Every agent implements this. Contains the actual AI logic. */
  abstract execute(input: unknown): Promise<AgentResult<unknown>>;

  /** Public entry point — wraps execute with logging, timing, escalation. */
  async run(organizationId: string, input: unknown): Promise<AgentResult<unknown>> {
    const startTime = Date.now();

    try {
      const result = await this.execute(input);
      const durationMs = Date.now() - startTime;

      await this.log(organizationId, {
        action: `${this.agentName}.execute`,
        inputSummary: input,
        outputSummary: result.data,
        confidenceScore: result.confidenceScore,
        durationMs,
        tokensUsed: result.tokensUsed,
        status: result.shouldEscalate ? "ESCALATED" : "SUCCESS",
      });

      if (result.shouldEscalate) {
        await this.escalate(organizationId, result.escalationReason ?? "Low confidence", input);
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      await this.log(organizationId, {
        action: `${this.agentName}.execute`,
        inputSummary: input,
        durationMs,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /** Writes audit record to agent_logs table. Never skip this. */
  protected async log(organizationId: string, data: {
    action: string;
    inputSummary?: unknown;
    outputSummary?: unknown;
    confidenceScore?: number;
    durationMs: number;
    tokensUsed?: number;
    status: AgentLogStatus;
    errorMessage?: string;
  }) {
    await prisma.agentLog.create({
      data: {
        organizationId,
        agentName: this.agentName,
        action: data.action,
        inputSummary: this.truncateForLog(data.inputSummary),
        outputSummary: this.truncateForLog(data.outputSummary),
        confidenceScore: data.confidenceScore,
        durationMs: data.durationMs,
        tokensUsed: data.tokensUsed,
        costEstimate: data.tokensUsed ? this.estimateCost(data.tokensUsed) : undefined,
        status: data.status,
        errorMessage: data.errorMessage,
      },
    });
  }

  /** Creates an escalation record and triggers notifications. */
  protected async escalate(
    organizationId: string,
    reason: string,
    context: unknown,
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM"
  ) {
    const escalation = await prisma.escalation.create({
      data: {
        organizationId,
        agentName: this.agentName,
        reason,
        context: context as any,
        priority,
        status: "OPEN",
      },
    });

    // Trigger realtime notification via Supabase
    // await supabaseAdmin.from("escalation_notifications").insert({
    //   organization_id: organizationId,
    //   escalation_id: escalation.id,
    //   type: priority === "CRITICAL" ? "urgent" : "standard",
    // });

    // Send email for HIGH/CRITICAL
    // if (priority === "HIGH" || priority === "CRITICAL") {
    //   await sendEscalationEmail(organizationId, escalation);
    // }

    return escalation;
  }

  private truncateForLog(data: unknown): any {
    if (data === undefined || data === null) return null;
    const str = JSON.stringify(data);
    if (str.length > 5000) {
      return { _truncated: true, length: str.length, preview: str.slice(0, 2000) };
    }
    return data;
  }

  protected estimateCost(tokens: number): number {
    // Claude Sonnet pricing: ~$3/M input, ~$15/M output, averaged to ~$7.5/M
    return (tokens / 1_000_000) * 7.5;
  }
}
```

---

## Confidence Scoring

```typescript
// agents/shared/confidence.ts

export interface ConfidenceThresholds {
  autoExecute: number;     // ≥ this: execute without review
  flagForReview: number;   // ≥ this but < autoExecute: execute + flag in dashboard
  requireReview: number;   // ≥ this but < flag: queue for human review
  // < requireReview: escalate immediately
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoExecute: 0.90,
  flagForReview: 0.75,
  requireReview: 0.50,
};

export const MATURE_THRESHOLDS: ConfidenceThresholds = {
  autoExecute: 0.80,
  flagForReview: 0.65,
  requireReview: 0.40,
};

export type ContentAction = "auto_execute" | "flag_and_execute" | "queue_for_review" | "escalate";

export function resolveAction(confidence: number, thresholds: ConfidenceThresholds): ContentAction {
  if (confidence >= thresholds.autoExecute) return "auto_execute";
  if (confidence >= thresholds.flagForReview) return "flag_and_execute";
  if (confidence >= thresholds.requireReview) return "queue_for_review";
  return "escalate";
}

/** Determines if org should use relaxed thresholds based on track record. */
export async function getOrgThresholds(organizationId: string): Promise<ConfidenceThresholds> {
  // Check agent_logs for this org's recent performance
  // If >30 days of operation with <5% escalation rate, use MATURE_THRESHOLDS
  // Otherwise use DEFAULT_THRESHOLDS
  // TODO: Implement with actual query
  return DEFAULT_THRESHOLDS;
}
```

---

## Rules

1. **Every agent extends `BaseAgent`.** No standalone functions that call the LLM.
2. **Every agent output must include `confidenceScore`.** This is non-negotiable. It drives the entire auto-publish / review / escalate pipeline.
3. **Never call `execute()` directly.** Always go through `run()` which handles logging and escalation.
4. **All LLM responses must be validated with Zod.** Parse JSON from the response, validate against a schema, fail loudly if invalid.
5. **Agent logs are sacred.** They are the audit trail, cost tracker, and debugging backbone. Never skip logging, even on errors.
6. **Agents use the service-role Supabase client.** They bypass RLS because they operate across organizations. The dashboard uses the anon key with RLS.
7. **Agents never expose raw errors to users.** Log the full error, return a sanitized message.

---

## Creating a New Agent — Checklist

1. [ ] Create `agents/<agent-name>.ts`
2. [ ] Extend `BaseAgent`, pass the correct `AgentName` enum value
3. [ ] Define a Zod schema for the structured output
4. [ ] Define a TypeScript interface for the input
5. [ ] Implement `execute()` with a detailed system prompt
6. [ ] Parse and validate LLM response with the Zod schema
7. [ ] Return `AgentResult` with confidence score and escalation logic
8. [ ] Create an Inngest function in `inngest/functions/` that triggers this agent
9. [ ] Add integration test that validates output matches Zod schema
10. [ ] Update the Orchestrator to know about this agent
