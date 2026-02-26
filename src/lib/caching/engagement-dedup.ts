/**
 * LLM Caching - Layer 1: Engagement Scan Deduplication
 * 
 * Skips Claude calls when no new engagement activity since last scan.
 * Uses Redis to store activity hashes per org+platform.
 */

import { createHash } from "crypto";
import { redis } from "@/lib/redis";

const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface ActivitySnapshot {
  commentIds: string[];
  dmIds: string[];
  mentionIds: string[];
  mostRecentTimestamp: string;
}

/**
 * Generates a stable hash from an activity snapshot.
 * Order-insensitive: sorts IDs before hashing so different API response
 * orderings don't produce false "new activity" signals.
 */
function hashActivitySnapshot(snapshot: ActivitySnapshot): string {
  const normalized = {
    comments: [...snapshot.commentIds].sort(),
    dms: [...snapshot.dmIds].sort(),
    mentions: [...snapshot.mentionIds].sort(),
    ts: snapshot.mostRecentTimestamp,
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 16); // 16 chars is plenty for dedup
}

function dedupKey(organizationId: string, platform: string): string {
  return `engagement:dedup:${organizationId}:${platform}`;
}

/**
 * Checks if activity has changed since the last scan.
 *
 * Returns:
 *   { changed: false }  → Skip this scan entirely. No LLM call needed.
 *   { changed: true, snapshot: ... }  → Proceed. Pass snapshot to engagement agent.
 */
export async function checkEngagementChanged(
  organizationId: string,
  platform: string,
  currentSnapshot: ActivitySnapshot
): Promise<{ changed: false } | { changed: true; snapshot: ActivitySnapshot }> {
  const key = dedupKey(organizationId, platform);
  const currentHash = hashActivitySnapshot(currentSnapshot);

  try {
    const storedHash = await redis.get(key);

    if (storedHash === currentHash) {
      return { changed: false };
    }

    // Update the stored hash (with TTL to auto-expire orphaned orgs)
    await redis.set(key, currentHash, { ex: DEDUP_TTL_SECONDS });

    return { changed: true, snapshot: currentSnapshot };
  } catch (error) {
    // If Redis fails, assume changed to be safe (fallback to processing)
    console.error("Redis error in checkEngagementChanged:", error);
    return { changed: true, snapshot: currentSnapshot };
  }
}

/**
 * Force-invalidates the dedup cache for an org+platform.
 * Call this when a client connects a new account or if a scan should be forced.
 */
export async function invalidateEngagementCache(
  organizationId: string,
  platform: string
): Promise<void> {
  await redis.del(dedupKey(organizationId, platform));
}

/**
 * Returns cache hit stats for the admin dashboard cost view.
 */
export async function getEngagementCacheStats(
  organizationId: string
): Promise<{ platform: string; lastHash: string | null }[]> {
  const platforms = ["instagram", "facebook", "tiktok", "twitter", "linkedin"];
  return Promise.all(
    platforms.map(async (platform) => ({
      platform,
      lastHash: (await redis.get(dedupKey(organizationId, platform))) as string | null,
    }))
  );
}
