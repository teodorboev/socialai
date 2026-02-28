import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  adminPrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  let connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!connectionString) {
    // Fallback for build time when DATABASE_URL is not set
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  // Strip pgbouncer and other incompatible PgBouncer parameters for the pg driver
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("pool_timeout");
    connectionString = url.toString();
  } catch (e) {
    // ignore invalid URLs, let Pool handle the error
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// Regular prisma client - uses RLS for regular user queries
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Admin prisma client - bypasses RLS for system/admin operations
// This uses the service role which has elevated privileges
export const prismaAdmin = globalForPrisma.adminPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.adminPrisma = prismaAdmin;
}
