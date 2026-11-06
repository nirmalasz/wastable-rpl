import { afterEach, describe, expect, it, vi } from 'vitest';

/** Reverse geocoding with Nominatim stubbed out: no network, no load on the free service. */
vi.stubEnv('GEOCODER', 'nominatim');
const { formatAddress, reverseGeocode } = await import('../src/lib/geocode.js');

afterEach(() => vi.unstubAllGlobals());

const nominatim = {
  display_name: 'Jalan Margonda Raya, Pondok Cina, Beji, Depok, Jawa Barat, 16424, Indonesia',
  address: {
    road: 'Jalan Margonda Raya',
    house_number: '100',
    suburb: 'Pondok Cina',
    city_district: 'Beji',
    city: 'Depok',
    state: 'Jawa Barat',
  },
};

describe('formatAddress', () => {
  it('builds a short street address and a coarse public area', () => {
    expect(formatAddress(nominatim.address, nominatim.display_name)).toEqual({
      address: 'Jalan Margonda Raya 100, Pondok Cina, Beji, Depok',
      area: 'Pondok Cina, Depok',
    });
  });

  it('falls back to the display name when there is no usable detail', () => {
    expect(formatAddress({}, 'Somewhere')).toEqual({ address: 'Somewhere', area: null });
  });
});

describe('reverseGeocode', () => {
  it('calls Nominatim with an identifying User-Agent and caches the result', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(nominatim)));
    vi.stubGlobal('fetch', fetch);

    const first = await reverseGeocode(-6.36, 106.83);
    const second = await reverseGeocode(-6.36, 106.83);
    expect(first?.address).toBe('Jalan Margonda Raya 100, Pondok Cina, Beji, Depok');
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);

    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.hostname).toBe('nominatim.openstreetmap.org');
    expect(url.searchParams.get('lat')).toBe('-6.36');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/WASTABLE/);
  });

  it('returns null instead of throwing when the service fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('busy', { status: 429 })),
    );
    await expect(reverseGeocode(1.23, 4.56)).resolves.toBeNull();
  });

  it('spaces calls at least a second apart (Nominatim usage policy)', async () => {
    const times: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        times.push(Date.now());
        return new Response(JSON.stringify(nominatim));
      }),
    );
    await Promise.all([reverseGeocode(2.1, 3.1), reverseGeocode(2.2, 3.2)]);
    expect(times).toHaveLength(2);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1000);
  });
});
