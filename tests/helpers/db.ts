/**
 * Test Database Utilities
 * 
 * Provides transaction-based test isolation using Prisma.
 * Each test runs in a transaction that rolls back after completion.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Test database client
let prisma: PrismaClient;
let testPool: pg.Pool;

/**
 * Setup test database connection
 */
export async function setupTestDb() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL must be set for tests");
  }

  testPool = new Pool({ connectionString });
  const adapter = new PrismaPg(testPool);
  
  prisma = new PrismaClient({
    adapter,
    log: process.env.DEBUG_TESTS === "true" ? ["query", "error"] : ["error"],
  });

  // Verify connection
  await prisma.$queryRaw`SELECT 1`;
  
  return prisma;
}

/**
 * Teardown test database connection
 */
export async function teardownTestDb() {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (testPool) {
    await testPool.end();
  }
}

/**
 * Start a new transaction for test isolation
 * Returns transaction client that operations should use
 */
export async function startTransaction() {
  // Begin transaction
  await prisma.$executeRaw`BEGIN`;
  
  // Return the prisma client - all operations in this test
  // will use this same connection with the transaction
  return prisma;
}

/**
 * Rollback the current transaction
 */
export async function rollbackTransaction(tx: PrismaClient) {
  try {
    await tx.$executeRaw`ROLLBACK`;
  } catch (error) {
    // Transaction might already be rolled back
    console.warn("Transaction rollback warning:", error);
  }
}

/**
 * Reset test database by truncating all tables
 * Use only for cleanup between test suites, not between individual tests
 */
export async function resetTestDb() {
  // Get all table names
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE '_prisma_%'
    AND tablename NOT LIKE 'pg_%'
  `;

  // Truncate all tables
  for (const { tablename } of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    } catch {
      // Ignore errors for tables that can't be truncated
    }
  }
}

/**
 * Get the test database client
 */
export function getTestDb() {
  if (!prisma) {
    throw new Error("Test database not initialized. Call setupTestDb() first.");
  }
  return prisma;
}
