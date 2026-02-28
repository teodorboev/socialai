import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  adminPrisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!connectionString) {
    // Fallback for build time when DATABASE_URL is not set
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  // The standard Prisma engine handles pgbouncer correctly without causing "Tenant or user not found"
  return new PrismaClient({
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
