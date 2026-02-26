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
import { getSmartRouterMock, resetSmartRouterMock } from "../mocks/smart-router.mock";
import { getStripeMock, resetStripeMock } from "../mocks/stripe.mock";
import { getInngestMock, resetInngestMock } from "../mocks/inngest.mock";
import { getSupabaseMock, resetSupabaseMock } from "../mocks/supabase.mock";

let transaction: any;
let dbConnected = false;

// Global mocks for memory module to avoid credential issues
vi.mock("@/lib/memory/embeddings", () => ({
  createEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
  generateEmbeddings: vi.fn().mockResolvedValue([
    new Array(1536).fill(0).map(() => Math.random()),
  ]),
  getEmbeddingConfig: vi.fn().mockReturnValue({ provider: "openai", model: "text-embedding-3-small" }),
  estimateTokens: vi.fn().mockReturnValue(100),
  truncateToTokens: vi.fn().mockImplementation((text: string) => text),
}));

vi.mock("@/lib/memory/store", () => ({
  MemoryStore: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  })),
  storeMemory: vi.fn().mockResolvedValue(undefined),
  storeMemories: vi.fn().mockResolvedValue(undefined),
  DEFAULT_IMPORTANCE: {},
  EXPIRATION_DAYS: {},
}));

vi.mock("@/lib/memory/recall", () => ({
  recallMemories: vi.fn().mockResolvedValue([]),
  recall: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/memory/recent", () => ({
  getRecentMemories: vi.fn().mockResolvedValue([]),
  getRecentByTypes: vi.fn().mockResolvedValue([]),
  recent: vi.fn().mockResolvedValue([]),
  recentByTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/memory", () => ({
  memory: {
    store: vi.fn().mockResolvedValue(undefined),
    storeMany: vi.fn().mockResolvedValue(undefined),
    recall: vi.fn().mockResolvedValue([]),
    recent: vi.fn().mockResolvedValue([]),
    recentByTypes: vi.fn().mockResolvedValue([]),
  },
  MAX_MEMORY_CONTEXT_TOKENS: 2000,
  formatMemoriesForPrompt: vi.fn().mockReturnValue(""),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/ai/prompts/loader", () => ({
  loadPrompt: vi.fn().mockRejectedValue(new Error("Prompt not found")),
}));

beforeAll(async () => {
  // Try to setup test database connection (optional for unit tests)
  try {
    await setupTestDb();
    dbConnected = true;
  } catch (error) {
    console.log("Database not available for tests - using mocks only");
    dbConnected = false;
  }
  
  // Initialize all mocks
  getSmartRouterMock();
  getStripeMock();
  getInngestMock();
  getSupabaseMock();
});

afterAll(async () => {
  // Cleanup test database if connected
  if (dbConnected) {
    await teardownTestDb();
  }
});

beforeEach(async () => {
  // Start a new transaction for this test if database is connected
  if (dbConnected) {
    transaction = await startTransaction();
  }
  
  // Reset all mock call histories
  vi.clearAllMocks();
});

afterEach(async () => {
  // Rollback the transaction to isolate tests if database is connected
  if (dbConnected && transaction) {
    await rollbackTransaction(transaction);
    transaction = null;
  }
  
  // Reset mocks to initial state
  resetSmartRouterMock();
  resetStripeMock();
  resetInngestMock();
  resetSupabaseMock();
});
