import { env } from '../config/env.js';
import { logger } from './logger.js';
import { getRedis } from './redis.js';

/**
 * Tiny key-value store used for the AI prompt cache and daily quota.
 * Uses Redis when reachable and transparently falls back to process memory otherwise
 * (always memory in tests), so the API keeps working without Redis.
 */
const memory = new Map<string, { value: string; expiresAt: number }>();
let redisDownUntil = 0;

const live = (key: string) => {
  const hit = memory.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return hit;
};

async function viaRedis<T>(
  op: (r: ReturnType<typeof getRedis>) => Promise<T>,
): Promise<T | undefined> {
  if (env.NODE_ENV === 'test' || Date.now() < redisDownUntil) return undefined;
  try {
    return await Promise.race([
      op(getRedis()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), 1500)),
    ]);
  } catch (err) {
    redisDownUntil = Date.now() + 30_000;
    logger.warn({ err: (err as Error).message }, 'Redis unavailable, using in-memory fallback');
    return undefined;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  const r = await viaRedis((c) => c.get(key));
  if (r !== undefined) return r;
  return live(key)?.value ?? null;
}

export async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const r = await viaRedis((c) => c.set(key, value, 'EX', ttlSeconds));
  if (r === undefined) memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function kvIncr(key: string, ttlSeconds: number): Promise<number> {
  const r = await viaRedis(async (c) => {
    const n = await c.incr(key);
    if (n === 1) await c.expire(key, ttlSeconds);
    return n;
  });
  if (r !== undefined) return r;
  const current = Number(live(key)?.value ?? 0) + 1;
  const existing = live(key);
  memory.set(key, {
    value: String(current),
    expiresAt: existing?.expiresAt ?? Date.now() + ttlSeconds * 1000,
  });
  return current;
}

export async function kvDel(key: string): Promise<void> {
  await viaRedis((c) => c.del(key));
  memory.delete(key);
}

export async function kvDecr(key: string): Promise<void> {
  const r = await viaRedis((c) => c.decr(key));
  if (r === undefined) {
    const existing = live(key);
    if (existing) existing.value = String(Math.max(0, Number(existing.value) - 1));
  }
}
