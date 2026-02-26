/**
 * Global Test Setup
 * 
 * Handles transaction-based test isolation:
 * - Each test runs in a Prisma transaction
 * - Transaction rolls back after each test
 * - Mocks are reset between tests
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { setupTestDb, teardownTestDb, startTransaction, rollbackTransaction } from "./db";
import { mockSmartRouter, resetSmartRouterMocks } from "../mocks/smart-router.mock";
import { mockStripe, resetStripeMocks } from "../mocks/stripe.mock";
import { mockInngest, clearEmittedEvents } from "../mocks/inngest.mock";
import { mockSupabase, resetSupabaseMocks } from "../mocks/supabase.mock";

let transaction: any;

beforeAll(async () => {
  // Setup test database connection
  await setupTestDb();
  
  // Initialize all mocks
  mockSmartRouter();
  mockStripe();
  mockInngest();
  mockSupabase();
});

afterAll(async () => {
  // Cleanup test database
  await teardownTestDb();
});

beforeEach(async () => {
  // Start a new transaction for this test
  transaction = await startTransaction();
  
  // Clear any previously emitted events
  clearEmittedEvents();
  
  // Reset all mock call histories
  vi.clearAllMocks();
});

afterEach(async () => {
  // Rollback the transaction to isolate tests
  if (transaction) {
    await rollbackTransaction(transaction);
    transaction = null;
  }
  
  // Reset mocks to initial state
  resetSmartRouterMocks();
  resetStripeMocks();
  resetSupabaseMocks();
});
