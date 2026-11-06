import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/** Groq adapter with the network stubbed out: no key, no quota, no cost. */
vi.stubEnv('GROQ_API_KEY', 'test-key');
vi.stubEnv('GROQ_MODEL', 'openai/gpt-oss-20b');

let callGroq: typeof import('../src/ai/groq.js').callGroq;
let AiUnavailableError: typeof import('../src/ai/types.js').AiUnavailableError;

beforeAll(async () => {
  // env.ts reads process.env on import, so import after stubbing.
  ({ callGroq } = await import('../src/ai/groq.js'));
  ({ AiUnavailableError } = await import('../src/ai/types.js'));
});

afterEach(() => vi.unstubAllGlobals());

function mockFetch(response: { status?: number; body?: unknown } | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status ?? 200 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const reply = (content: string | null) => ({ body: { choices: [{ message: { content } }] } });

describe('callGroq', () => {
  it('sends an OpenAI-style JSON-mode request and returns the content', async () => {
    const fetch = mockFetch(reply('{"verdict":"OK"}'));
    await expect(callGroq([{ text: 'line 1' }, { text: 'line 2' }])).resolves.toBe(
      '{"verdict":"OK"}',
    );

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.reasoning_effort).toBe('low');
    expect(body.messages).toEqual([{ role: 'user', content: 'line 1\nline 2' }]);
  });

  it('drops image parts when vision is off', async () => {
    const fetch = mockFetch(reply('{}'));
    await callGroq([{ text: 'describe' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }]);
    const body = JSON.parse(
      String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.messages[0].content).toBe('describe');
  });

  it.each([
    ['an HTTP error', { status: 429 }],
    ['an empty reply', reply(null)],
    ['a network failure', new Error('ECONNRESET')],
  ])('turns %s into AiUnavailableError so callers fall back', async (_name, response) => {
    mockFetch(response);
    await expect(callGroq([{ text: 'x' }])).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
