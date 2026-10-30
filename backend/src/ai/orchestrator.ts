import type { ZodType } from 'zod';
import { env } from '../config/env.js';
import { sha256 } from '../lib/crypto.js';
import { getDb } from '../db/client.js';
import { aiRequestLogs } from '../db/schema.js';
import { kvDecr, kvGet, kvIncr, kvSet } from '../lib/kv.js';
import { logger } from '../lib/logger.js';
import { callGemini, type GeminiPart } from './gemini.js';
import { AiQuotaError, AiUnavailableError, type AgentType } from './types.js';

/**
 * Agent Orchestrator: the single place that talks to Gemini.
 *  - enforces the per-user daily AI quota (env.AI_DAILY_REQUEST_LIMIT)
 *  - caches identical prompts
 *  - requests JSON output and validates it against a zod schema
 *  - logs usage to ai_request_logs
 * Callers must handle AiUnavailableError by falling back to rule-based behaviour.
 */
export const aiConfig = {
  enabled: Boolean(env.GEMINI_API_KEY),
  model: env.GEMINI_MODEL,
  dailyLimit: env.AI_DAILY_REQUEST_LIMIT,
};

const CACHE_TTL_SECONDS = 60 * 60;
const today = () => new Date().toISOString().slice(0, 10);

interface RunAgentOptions<T> {
  userId: string;
  agent: AgentType;
  /** Instruction + user content as text. Also the cache key. */
  prompt: string;
  /** Extra non-text parts, e.g. an inline photo. */
  extraParts?: GeminiPart[];
  /** Part of the cache key for extraParts (e.g. the photo URL). */
  cacheSalt?: string;
  schema: ZodType<T>;
  /** Count this call against the user's daily quota (user-triggered features). */
  enforceQuota?: boolean;
}

const FENCE = '`'.repeat(3);
const extractJson = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(FENCE)) return trimmed;
  return trimmed
    .replace(/^`{3}(?:json)?/, '')
    .replace(/`{3}$/, '')
    .trim();
};

export async function runAgent<T>(opts: RunAgentOptions<T>): Promise<{ data: T; cached: boolean }> {
  if (!aiConfig.enabled) throw new AiUnavailableError('AI is not configured');

  const promptHash = sha256(`${opts.agent}|${opts.prompt}|${opts.cacheSalt ?? ''}`);
  const cacheKey = `ai:cache:${promptHash}`;

  const cachedRaw = await kvGet(cacheKey);
  if (cachedRaw) {
    const parsed = opts.schema.safeParse(JSON.parse(cachedRaw));
    if (parsed.success) {
      await logUsage(opts, promptHash, true);
      return { data: parsed.data, cached: true };
    }
  }

  const quotaKey = `ai:quota:${opts.userId}:${today()}`;
  let counted = false;
  if (opts.enforceQuota) {
    const used = await kvIncr(quotaKey, 60 * 60 * 26);
    counted = true;
    if (used > aiConfig.dailyLimit) {
      await kvDecr(quotaKey);
      throw new AiQuotaError();
    }
  }

  try {
    const raw = await callGemini([{ text: opts.prompt }, ...(opts.extraParts ?? [])]);
    let json: unknown;
    try {
      json = JSON.parse(extractJson(raw));
    } catch {
      throw new AiUnavailableError('Gemini returned invalid JSON');
    }
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) throw new AiUnavailableError('Gemini output did not match the schema');
    await kvSet(cacheKey, JSON.stringify(parsed.data), CACHE_TTL_SECONDS);
    await logUsage(opts, promptHash, false);
    return { data: parsed.data, cached: false };
  } catch (err) {
    if (counted) await kvDecr(quotaKey); // failed calls do not burn the user's quota
    throw err;
  }
}

async function logUsage<T>(opts: RunAgentOptions<T>, promptHash: string, cacheHit: boolean) {
  try {
    await getDb()
      .insert(aiRequestLogs)
      .values({ userId: opts.userId, agentType: opts.agent, promptHash, cacheHit });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'could not write ai_request_logs');
  }
}

/** Remaining requests for the user today (for the UI). */
export async function remainingQuota(userId: string): Promise<number> {
  const used = Number((await kvGet(`ai:quota:${userId}:${today()}`)) ?? 0);
  return Math.max(0, aiConfig.dailyLimit - used);
}
