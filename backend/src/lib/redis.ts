import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let client: Redis | undefined;

/** Lazily created Redis client (prompt cache, AI quota, rate limits, tokens). */
export function getRedis(): Redis {
  client ??= new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  return client;
}
