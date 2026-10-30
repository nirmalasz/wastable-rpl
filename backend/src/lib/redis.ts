import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let client: Redis | undefined;

/** Lazily created Redis client (prompt cache, AI quota, rate limits, tokens). */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 1000, 15_000),
    });
    client.on('error', () => undefined); // surfaced through kv.ts fallbacks instead
  }
  return client;
}
