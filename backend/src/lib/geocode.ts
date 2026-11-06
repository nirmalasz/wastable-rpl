import { env } from '../config/env.js';
import { kvGet, kvSet } from './kv.js';
import { logger } from './logger.js';

/**
 * Reverse geocoding (pin -> street address) via OpenStreetMap Nominatim, which is free under its
 * usage policy: at most 1 request per second, an identifying User-Agent, and caching results.
 * https://operations.osmfoundation.org/policies/nominatim/
 * Returns null when switched off (GEOCODER=off) or on any failure, so callers never break.
 */
export interface GeocodedAddress {
  /** Street-level address, private like the pin. */
  address: string;
  /** Neighbourhood + city, coarse enough to suggest as the public pickup area. */
  area: string | null;
}

const CACHE_TTL_SECONDS = 30 * 24 * 3600;
const MIN_INTERVAL_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Serialises calls so the whole API stays under Nominatim's 1 request/second limit. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  city_district?: string;
  city?: string;
  town?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

/** Short Indonesian-style address: "Jl. Margonda Raya 100, Pondok Cina, Beji, Depok". */
export function formatAddress(a: NominatimAddress, fallback: string): GeocodedAddress {
  const street = [a.road, a.house_number].filter(Boolean).join(' ');
  const local = a.neighbourhood ?? a.suburb ?? a.village;
  const district = a.city_district;
  const city = a.city ?? a.town ?? a.county;
  const parts = [street, local, district, city].filter(
    (p, i, all): p is string => Boolean(p) && all.indexOf(p) === i,
  );
  const areaParts = [a.suburb ?? a.village ?? district, city].filter(Boolean);
  return {
    address: parts.length > 0 ? parts.join(', ') : fallback,
    area: areaParts.length > 0 ? [...new Set(areaParts)].join(', ') : null,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress | null> {
  if (env.GEOCODER === 'off') return null;
  // ~1 m precision is plenty and keeps nearby pins sharing a cache entry.
  const key = `geo:rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = await kvGet(key);
  if (cached) return JSON.parse(cached) as GeocodedAddress;

  try {
    const result = await throttled(async () => {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.search = new URLSearchParams({
        format: 'jsonv2',
        lat: String(lat),
        lon: String(lng),
        zoom: '18',
        addressdetails: '1',
        'accept-language': 'id,en',
      }).toString();
      const res = await fetch(url, {
        headers: { 'User-Agent': env.GEOCODER_USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Nominatim responded with ${res.status}`);
      const body = (await res.json()) as { display_name?: string; address?: NominatimAddress };
      if (!body.address) return null;
      return formatAddress(body.address, body.display_name ?? '');
    });
    if (result) await kvSet(key, JSON.stringify(result), CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'reverse geocoding failed');
    return null;
  }
}
