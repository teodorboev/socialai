import { prisma } from "@/lib/prisma";
import type { AgentName, Organization } from "@prisma/client";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMinutes: number;
  resetAfterSuccess: boolean;
  halfOpenMaxCalls: number;
}

export interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  isOpen: boolean;
  isHalfOpen: boolean;
  consecutiveFailures: number;
}

export interface CircuitBreakerStats {
  agent: string;
  organizationId: string;
  state: CircuitState;
  totalFailures: number;
  totalSuccesses: number;
  successRate: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMinutes: 30,
  resetAfterSuccess: true,
  halfOpenMaxCalls: 1,
};

const circuitStates: Map<string, CircuitState> = new Map();
const stats: Map<string, { failures: number; successes: number }> = new Map();

function getCircuitKey(agent: AgentName, organizationId: string): string {
  return `${agent}:${organizationId}`;
}

function getDefaultState(): CircuitState {
  return {
    failures: 0,
    lastFailure: null,
    lastSuccess: null,
    isOpen: false,
    isHalfOpen: false,
    consecutiveFailures: 0,
  };
}

export function getCircuitBreakerConfig(organizationId?: string): CircuitBreakerConfig {
  return DEFAULT_CONFIG;
}

export function getCircuitState(agent: AgentName, organizationId: string): CircuitState {
  const key = getCircuitKey(agent, organizationId);
  return circuitStates.get(key) || getDefaultState();
}

export function isCircuitOpen(agent: AgentName, organizationId: string): boolean {
  const state = getCircuitState(agent, organizationId);
  const config = getCircuitBreakerConfig(organizationId);

  if (!state.isOpen && !state.isHalfOpen) {
    return false;
  }

  if (state.isOpen) {
    const cooldownEnd = new Date(state.lastFailure!.getTime() + config.cooldownMinutes * 60 * 1000);
    
    if (new Date() > cooldownEnd) {
      circuitStates.set(getCircuitKey(agent, organizationId), {
        ...state,
        isOpen: false,
        isHalfOpen: true,
        consecutiveFailures: 0,
      });
      return false;
    }
    
    return true;
  }

  if (state.isHalfOpen) {
    return false;
  }

  return false;
}

export function recordSuccess(agent: AgentName, organizationId: string): void {
  const key = getCircuitKey(agent, organizationId);
  const state = getCircuitState(agent, organizationId);
  const config = getCircuitBreakerConfig(organizationId);

  const statsKey = `${key}:stats`;
  const currentStats = stats.get(statsKey) || { failures: 0, successes: 0 };
  stats.set(statsKey, { ...currentStats, successes: currentStats.successes + 1 });

  const newState: CircuitState = {
    ...state,
    lastSuccess: new Date(),
    consecutiveFailures: 0,
  };

  if (state.isHalfOpen) {
    newState.isHalfOpen = false;
    newState.isOpen = false;
    newState.failures = 0;
  }

  if (config.resetAfterSuccess) {
    newState.failures = 0;
  }

  circuitStates.set(key, newState);
}

export function recordFailure(agent: AgentName, organizationId: string, error?: string): void {
  const key = getCircuitKey(agent, organizationId);
  const state = getCircuitState(agent, organizationId);
  const config = getCircuitBreakerConfig(organizationId);

  const statsKey = `${key}:stats`;
  const currentStats = stats.get(statsKey) || { failures: 0, successes: 0 };
  stats.set(statsKey, { ...currentStats, failures: currentStats.failures + 1 });

  const newState: CircuitState = {
    ...state,
    failures: state.failures + 1,
    consecutiveFailures: state.consecutiveFailures + 1,
    lastFailure: new Date(),
  };

  if (newState.consecutiveFailures >= config.failureThreshold) {
    newState.isOpen = true;
    console.error(
      `Circuit breaker opened for ${agent}:${organizationId} after ${newState.consecutiveFailures} consecutive failures`
    );
  }

  circuitStates.set(key, newState);

  logCircuitBreakerEvent(agent, organizationId, "failure", error);
}

function logCircuitBreakerEvent(
  agent: AgentName,
  organizationId: string,
  event: "opened" | "closed" | "half-open" | "failure" | "success",
  error?: string
): void {
  console.log(
    `[CircuitBreaker] ${event.toUpperCase()}: ${agent}:${organizationId}`,
    error ? `Error: ${error}` : ""
  );
}

export function resetCircuitBreaker(agent: AgentName, organizationId: string): void {
  const key = getCircuitKey(agent, organizationId);
  circuitStates.set(key, getDefaultState());
  logCircuitBreakerEvent(agent, organizationId, "closed");
}

export function getCircuitBreakerStats(agent: AgentName, organizationId: string): CircuitBreakerStats {
  const key = getCircuitKey(agent, organizationId);
  const state = getCircuitState(agent, organizationId);
  const statsKey = `${key}:stats`;
  const currentStats = stats.get(statsKey) || { failures: 0, successes: 0 };

  const total = currentStats.failures + currentStats.successes;
  const successRate = total > 0 ? currentStats.successes / total : 1;

  return {
    agent,
    organizationId,
    state,
    totalFailures: currentStats.failures,
    totalSuccesses: currentStats.successes,
    successRate,
  };
}

export async function getAllCircuitBreakerStats(): Promise<CircuitBreakerStats[]> {
  const statsList: CircuitBreakerStats[] = [];

  for (const [key, state] of circuitStates.entries()) {
    const [agent, organizationId] = key.split(":");
    if (agent && organizationId && !key.includes(":stats")) {
      statsList.push(getCircuitBreakerStats(agent as AgentName, organizationId));
    }
  }

  return statsList;
}

export function isCircuitHealthy(agent: AgentName, organizationId: string): boolean {
  const stats = getCircuitBreakerStats(agent, organizationId);
  return stats.successRate >= 0.5 || stats.totalFailures === 0;
}

export async function checkAndRecoverExpiredSubscriptions(): Promise<void> {
  const expiredOrgs = await prisma.organization.findMany({
    where: {
      OR: [
        { trialEndsAt: { lt: new Date() } },
        { stripeSubId: null, plan: "STARTER" },
      ],
    },
  });

  for (const org of expiredOrgs) {
    for (const agent of [
      "CONTENT_CREATOR",
      "ENGAGEMENT",
      "STRATEGY",
      "ANALYTICS",
      "TREND_SCOUT",
      "VISUAL",
      "PUBLISHER",
    ] as AgentName[]) {
      resetCircuitBreaker(agent, org.id);
    }
  }
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(
    agent: AgentName,
    organizationId: string,
    operation: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    if (isCircuitOpen(agent, organizationId)) {
      const state = getCircuitState(agent, organizationId);
      const config = getCircuitBreakerConfig(organizationId);
      const cooldownEnd = new Date(
        state.lastFailure!.getTime() + config.cooldownMinutes * 60 * 1000
      );

      return {
        success: false,
        error: `Circuit breaker open. Retry after ${cooldownEnd.toISOString()}`,
      };
    }

    try {
      const data = await operation();
      recordSuccess(agent, organizationId);
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      recordFailure(agent, organizationId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  getState(agent: AgentName, organizationId: string): CircuitState {
    return getCircuitState(agent, organizationId);
  }

  reset(agent: AgentName, organizationId: string): void {
    resetCircuitBreaker(agent, organizationId);
  }

  getStats(agent: AgentName, organizationId: string): CircuitBreakerStats {
    return getCircuitBreakerStats(agent, organizationId);
  }
}

export const circuitBreaker = new CircuitBreaker();
