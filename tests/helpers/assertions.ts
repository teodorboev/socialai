/**
 * Custom Test Assertions
 * 
 * Provides domain-specific assertions for SocialAI tests.
 */

import { expect } from "vitest";
import { z } from "zod";

/**
 * Assert that a value is a valid confidence score (0-1)
 */
export function expectConfidenceScore(score: number) {
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(1);
  expect(typeof score).toBe("number");
}

/**
 * Assert that a result contains escalation
 */
export function expectEscalation(result: {
  shouldEscalate: boolean;
  escalationReason?: string;
}) {
  expect(result.shouldEscalate).toBe(true);
  expect(result.escalationReason).toBeDefined();
  expect(result.escalationReason!.length).toBeGreaterThan(0);
}

/**
 * Assert that output matches a Zod schema
 */
export function expectSchema<T>(output: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(output);
  if (!result.success) {
    const errorMessages = result.error.issues.map((issue: z.ZodIssue) => 
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');
    throw new Error(`Schema validation failed: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Assert that result was successful
 */
export function expectSuccess(result: { success: boolean; data?: unknown }) {
  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
}

/**
 * Assert that result was a failure
 */
export function expectFailure(result: { success: boolean; error?: string }) {
  expect(result.success).toBe(false);
}

/**
 * Assert that agent call was logged
 */
export function expectActivityLogged(
  activities: Array<{ agentName: string; action: string }>,
  agentName: string,
  action?: string
) {
  const match = activities.find(
    a => a.agentName === agentName && (!action || a.action.includes(action))
  );
  expect(match).toBeDefined();
}

/**
 * Assert that specific tier was used
 */
export function expectTier(result: { tier: string }, expectedTier: string) {
  expect(result.tier).toBe(expectedTier);
}

/**
 * Assert that billing gate blocked agent
 */
export function expectBillingGateBlocked(result: {
  status: string;
  reason?: string;
}) {
  expect(result.status).toBe("skipped");
  expect(result.reason).toBe("plan_limit");
}

/**
 * Assert that memory was stored
 */
export function expectMemoryStored(
  memories: Array<{ agentSource: string; memoryType: string }>,
  agentName: string,
  memoryType?: string
) {
  const match = memories.find(
    m => m.agentSource === agentName && (!memoryType || m.memoryType === memoryType)
  );
  expect(match).toBeDefined();
}

/**
 * Assert that do-nots were respected in content
 */
export function expectDoNotsRespected(
  content: string,
  doNots: string[]
) {
  const contentLower = content.toLowerCase();
  for (const doNot of doNots) {
    expect(contentLower).not.toContain(doNot.toLowerCase());
  }
}
