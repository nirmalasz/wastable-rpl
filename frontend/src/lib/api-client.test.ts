import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api-client';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('api', () => {
  it('GETs by default and sends the bearer token', async () => {
    const fetch = stubFetch(json({ ok: true }));
    await expect(api('/cart', { token: 'abc' })).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/cart');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('POSTs JSON when a body is given', async () => {
    const fetch = stubFetch(json({ id: 1 }, 201));
    await api('/cart', { body: { listingId: 'x' } });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"listingId":"x"}');
  });

  it('resolves to null for empty responses such as 204', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(api('/cart/x', { method: 'DELETE' })).resolves.toBeNull();
  });

  it("turns API errors into ApiError with the server's message and field errors", async () => {
    stubFetch(json({ error: 'Check the form', fields: { price: 'Too low' } }, 400));
    const err = await api('/listings', { body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      message: 'Check the form',
      fields: { price: 'Too low' },
    });
  });

  it('uses a friendly message when the server gives none', async () => {
    stubFetch(new Response('Bad gateway', { status: 502 }));
    await expect(api('/health')).rejects.toMatchObject({
      status: 502,
      message: 'Something went wrong. Please try again.',
    });
  });

  it('reports network failures as status 0', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(api('/health')).rejects.toMatchObject({
      status: 0,
      message: 'Cannot reach the server. Check your connection and try again.',
    });
  });
});
