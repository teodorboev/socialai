// ============================================================================
// Inngest Mock - Event capture and function triggering for testing
// ============================================================================

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface InngestEvent<T = Record<string, unknown>> {
  name: string;
  data: T;
  user?: {
    id: string;
    [key: string]: unknown;
  };
  timestamp?: number;
  v?: string;
}

export interface InngestStep {
  id: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  output?: unknown;
  error?: string;
}

export interface InngestFunctionRun {
  id: string;
  functionId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: InngestStep[];
  startedAt: Date;
  endedAt?: Date;
}

export interface InngestFunction {
  id: string;
  name: string;
  triggers: string[];
  enabled: boolean;
}

// ============================================================================
// Mock Implementation
// ============================================================================

export class MockInngest {
  // Event history for verification
  events: InngestEvent[] = [];
  
  // Function runs tracking
  functionRuns: InngestFunctionRun[] = [];
  
  // Registered functions
  functions: Map<string, InngestFunction> = new Map();
  
  // Event handlers
  eventHandlers: Map<string, InngestEvent[]> = new Map();

  private runIdCounter = 1000;

  // ==========================================================================
  // Core Event Methods
  // ==========================================================================

  /**
   * Send an event to Inngest - used to trigger functions
   */
  async send<T extends Record<string, unknown> = Record<string, unknown>>(event: InngestEvent<T> | InngestEvent<T>[]): Promise<{
    ids: string[];
  }> {
    const events = Array.isArray(event) ? event : [event];
    
    for (const evt of events) {
      const eventWithDefaults: InngestEvent<Record<string, unknown>> = {
        ...evt,
        data: evt.data as Record<string, unknown>,
        timestamp: evt.timestamp || Date.now(),
        v: evt.v || '2024-01-01',
      };
      
      this.events.push(eventWithDefaults);
      
      // Trigger any registered handlers
      const handlers = this.eventHandlers.get(evt.name) || [];
      for (const handler of handlers) {
        // In real Inngest, this would queue async processing
        // For testing, we just record the event
      }
    }
    
    return { ids: events.map(() => `evt_${this.runIdCounter++}`) };
  }

  /**
   * Register an event handler (for testing event-driven triggers)
   */
  on(_eventName: string, _handler: (event: InngestEvent) => void): void {
    // Handler registration - in real impl this would store the handler
    // For testing, we just track events
  }

  // ==========================================================================
  // Function Registration (mock)
  // ==========================================================================

  /**
   * Register a function (for testing)
   */
  createFunction(config: {
    id: string;
    name?: string;
    retries?: number;
  }, trigger: { cron?: string; event?: string }): MockInngestFunction {
    const fn: InngestFunction = {
      id: config.id,
      name: config.name || config.id,
      triggers: [
        trigger.cron ? `cron:${trigger.cron}` : `event:${trigger.event}`,
      ].filter(Boolean),
      enabled: true,
    };
    
    this.functions.set(config.id, fn);
    
    return new MockInngestFunction(this, fn);
  }

  // ==========================================================================
  // Test Utilities
  // ==========================================================================

  /**
   * Get all events of a specific name
   */
  getEvents<T = Record<string, unknown>>(name: string): InngestEvent<T>[] {
    return this.events.filter(e => e.name === name) as InngestEvent<T>[];
  }

  /**
   * Get the last event of a specific name
   */
  getLastEvent<T = Record<string, unknown>>(name: string): InngestEvent<T> | undefined {
    const events = this.getEvents<T>(name);
    return events[events.length - 1];
  }

  /**
   * Clear all events and function runs
   */
  clear(): void {
    this.events = [];
    this.functionRuns = [];
  }

  /**
   * Get all captured events
   */
  getAllEvents(): InngestEvent[] {
    return [...this.events];
  }

  /**
   * Get all function runs
   */
  getAllRuns(): InngestFunctionRun[] {
    return [...this.functionRuns];
  }

  /**
   * Simulate a cron trigger
   */
  async simulateCron(cronExpression: string): Promise<void> {
    const matchingFunctions = Array.from(this.functions.values()).filter(fn => 
      fn.triggers.some(t => t === `cron:${cronExpression}`)
    );

    for (const fn of matchingFunctions) {
      const run: InngestFunctionRun = {
        id: `run_${this.runIdCounter++}`,
        functionId: fn.id,
        name: fn.name,
        status: 'completed',
        steps: [],
        startedAt: new Date(),
        endedAt: new Date(),
      };
      
      this.functionRuns.push(run);
    }
  }
}

// ============================================================================
// Mock Inngest Function Builder
// ============================================================================

export class MockInngestFunction {
  private inngest: MockInngest;
  private function: InngestFunction;

  constructor(inngest: MockInngest, fn: InngestFunction) {
    this.inngest = inngest;
    this.function = fn;
  }

  /**
   * Run the function (for manual testing)
   */
  async run(handler: (ctx: { step: MockStepRunner }) => Promise<void>): Promise<unknown> {
    const runId = `run_${Date.now()}`;
    
    const stepRunner = new MockStepRunner(runId, this.inngest);
    
    try {
      await handler({ step: stepRunner });
      return stepRunner.getResults();
    } catch (error) {
      throw error;
    }
  }
}

// ============================================================================
// Mock Step Runner
// ============================================================================

export class MockStepRunner {
  private runId: string;
  private inngest: MockInngest;
  private steps: Map<string, InngestStep> = new Map();

  constructor(runId: string, inngest: MockInngest) {
    this.runId = runId;
    this.inngest = inngest;
  }

  /**
   * Run a step with a unique ID
   */
  async run<T>(id: string, handler: () => Promise<T>): Promise<T> {
    const step: InngestStep = {
      id,
      name: id,
      startedAt: new Date(),
      status: 'running',
    };
    
    this.steps.set(id, step);
    
    try {
      const result = await handler();
      step.status = 'completed';
      step.endedAt = new Date();
      step.output = result;
      this.steps.set(id, step);
      return result;
    } catch (error) {
      step.status = 'failed';
      step.endedAt = new Date();
      step.error = error instanceof Error ? error.message : 'Unknown error';
      this.steps.set(id, step);
      throw error;
    }
  }

  getResults(): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    for (const [id, step] of this.steps) {
      results[id] = step.output;
    }
    return results;
  }
}

// ============================================================================
// Singleton for test reuse
// ============================================================================

let inngestInstance: MockInngest | null = null;

export function getInngestMock(): MockInngest {
  if (!inngestInstance) {
    inngestInstance = new MockInngest();
  }
  return inngestInstance;
}

export function resetInngestMock(): void {
  inngestInstance = null;
}

// ============================================================================
// Common Test Events
// ============================================================================

export const TEST_EVENTS = {
  CONTENT_CREATED: 'content/created',
  CONTENT_APPROVED: 'content/approved',
  CONTENT_PUBLISHED: 'content/published',
  CONTENT_FAILED: 'content/failed',
  ENGAGEMENT_RECEIVED: 'engagement/received',
  ENGAGEMENT_RESPONDED: 'engagement/responded',
  ESCALATION_CREATED: 'escalation/created',
  ESCALATION_RESOLVED: 'escalation/resolved',
  SUBSCRIPTION_CREATED: 'subscription/created',
  SUBSCRIPTION_UPDATED: 'subscription/updated',
  SUBSCRIPTION_CANCELED: 'subscription/canceled',
  TRIAL_ENDING: 'trial/ending',
  PAYMENT_FAILED: 'payment/failed',
  ORG_CREATED: 'organization/created',
  ORG_DELETED: 'organization/deleted',
  BRAND_CONFIG_UPDATED: 'brand/updated',
  SOCIAL_ACCOUNT_CONNECTED: 'social-account/connected',
  SOCIAL_ACCOUNT_DISCONNECTED: 'social-account/disconnected',
};

// ============================================================================
// Test Helper
// ============================================================================

export function mockInngest() {
  const mock = getInngestMock();
  
  return {
    inngest: mock,
    events: TEST_EVENTS,
    MockInngestFunction,
    MockStepRunner,
  };
}
