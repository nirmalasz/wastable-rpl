import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

/**
 * Orchestrator + agents with the LLM faked: checks caching, quota, JSON validation and the
 * rule-based fallbacks without calling any real model. The KV store is in-memory in tests.
 */
const callModel = vi.fn<(parts: unknown[]) => Promise<string>>();
vi.mock('../src/ai/llm.js', () => ({
  llmProvider: { name: 'groq', enabled: true, model: 'fake-model' },
  callModel: (parts: unknown[]) => callModel(parts),
}));
// Usage logging writes to Postgres; keep these tests database-free.
vi.mock('../src/db/client.js', () => ({
  getDb: () => ({ insert: () => ({ values: async () => undefined }) }),
}));
vi.stubEnv('AI_DAILY_REQUEST_LIMIT', '2');

const { runAgent, remainingQuota } = await import('../src/ai/orchestrator.js');
const { AiQuotaError, AiUnavailableError } = await import('../src/ai/types.js');
const { moderateListing } = await import('../src/ai/agents/moderation-agent.js');
const { extractListingDraft } = await import('../src/ai/agents/listing-agent.js');

const schema = z.object({ ok: z.boolean() });
let n = 0;
/** Unique prompt + user per test so the shared cache and quota never leak between tests. */
const fresh = () => ({ userId: `user-${++n}`, prompt: `prompt ${n}` });

/** An outage as the orchestrator sees it: the reply is unusable, so it raises AiUnavailableError. */
const modelDown = async (): Promise<string> => 'Service Unavailable';

beforeEach(() => callModel.mockReset());

describe('runAgent', () => {
  it('parses JSON, including replies wrapped in a code fence', async () => {
    callModel.mockResolvedValueOnce('```json\n{"ok": true}\n```');
    const res = await runAgent({ ...fresh(), agent: 'MODERATION', schema });
    expect(res).toEqual({ data: { ok: true }, cached: false });
  });

  it('serves an identical prompt from cache without calling the model again', async () => {
    const opts = { ...fresh(), agent: 'MODERATION' as const, schema };
    callModel.mockResolvedValueOnce('{"ok": true}');
    await runAgent(opts);
    const second = await runAgent(opts);
    expect(second.cached).toBe(true);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('rejects output that is not JSON or does not match the schema', async () => {
    callModel.mockResolvedValueOnce('sure! here you go');
    await expect(runAgent({ ...fresh(), agent: 'LISTING', schema })).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
    callModel.mockResolvedValueOnce('{"ok": "yes"}');
    await expect(runAgent({ ...fresh(), agent: 'LISTING', schema })).rejects.toBeInstanceOf(
      AiUnavailableError,
    );
  });

  it('enforces the daily quota, and failed calls do not use it up', async () => {
    const { userId } = fresh();
    const call = (prompt: string) =>
      runAgent({ userId, prompt, agent: 'LISTING', schema, enforceQuota: true });

    callModel.mockRejectedValueOnce(new AiUnavailableError('down'));
    await expect(call('a')).rejects.toBeInstanceOf(AiUnavailableError);
    expect(await remainingQuota(userId)).toBe(2);

    callModel.mockResolvedValue('{"ok": true}');
    await call('b');
    await call('c');
    expect(await remainingQuota(userId)).toBe(0);
    await expect(call('d')).rejects.toBeInstanceOf(AiQuotaError);
    expect(callModel).toHaveBeenCalledTimes(3);
  });
});

describe('agent fallbacks when the model is unusable', () => {
  it('moderation keeps the rule-based verdict', async () => {
    callModel.mockImplementation(modelDown);
    const res = await moderateListing('Bir bintang 6 kaleng', `user-${++n}`);
    expect(res.source).toBe('RULES');
    expect(res.verdict).toBe('PROHIBITED');
  });

  it('listing extraction returns a heuristic draft', async () => {
    callModel.mockImplementation(modelDown);
    const draft = await extractListingDraft({ text: '5 nasi kotak ayam' }, `user-${++n}`);
    expect(draft.source).toBe('HEURISTIC');
    expect(draft.category).toBe('cooked-meal');
  });

  it('moderation uses the model verdict and adds diet flags', async () => {
    callModel.mockResolvedValueOnce(
      '{"verdict":"OK","dietFlags":["gluten"],"rationale":"bread contains gluten"}',
    );
    const res = await moderateListing(`Roti tawar gandum ${++n}`, `user-${n}`);
    expect(res).toMatchObject({ source: 'AI', verdict: 'DIET_FLAG', dietFlags: ['gluten'] });
  });
});
