/**
 * Redis Client - Upstash Integration
 * 
 * Used for:
 * - Layer 1: Engagement scan deduplication
 * - Session caching
 * - Rate limiting
 * 
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment.
 */

import { Redis } from "@upstash/redis";

// Create Redis client with lazy initialization
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      throw new Error("Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
    
    _redis = new Redis({
      url,
      token,
    });
  }
  
  return _redis;
}

// Re-export for convenience
export const redis = {
  get: async (key: string) => getRedis().get(key),
  set: async (key: string, value: string, opts?: { ex?: number }) => {
    if (opts?.ex) {
      return getRedis().set(key, value, { ex: opts.ex });
    }
    return getRedis().set(key, value);
  },
  del: async (key: string) => getRedis().del(key),
  exists: async (key: string) => getRedis().exists(key),
  expire: async (key: string, seconds: number) => getRedis().expire(key, seconds),
  ttl: async (key: string) => getRedis().ttl(key),
  // Hash operations for engagement dedup
  hset: async (key: string, field: string, value: string) => getRedis().hset(key, { [field]: value }),
  hget: async (key: string, field: string) => getRedis().hget(key, field),
  hgetall: async (key: string) => getRedis().hgetall(key),
};
