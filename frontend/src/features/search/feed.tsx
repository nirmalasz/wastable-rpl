'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingBlock,
  Select,
  listingGrid,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard } from '@/features/listings/listing-card';
import { humanize } from '@/lib/format';
import { CATEGORIES, type Listing, type SearchFilters } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const TYPE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'FREE', label: 'Free' },
  { value: 'SELL', label: 'For sale' },
  { value: 'EXCHANGE', label: 'Exchange' },
];

/** The API returns at most 50 listings per request (see GET /search). */
const PAGE = 20;
const MAX_LIMIT = 50;

interface ChatResult {
  filters: SearchFilters;
  results: Listing[];
  remainingAiRequests: number;
}

/**
 * The search page: filters (FR-6) and the conversational Discovery Agent search (FR-17).
 *
 * Every filter except the visitor's location lives in the URL (?q=&category=&type=&urgent=
 * &maxPrice=), so a search can be linked to, e.g. from the header search box, the home page
 * categories and the hero slides.
 */
export function Feed() {
  const { user, call } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const type = params.get('type') ?? '';
  const urgent = params.get('urgent') === 'true';
  const maxPrice = params.get('maxPrice') ?? '';

  const [maxPriceDraft, setMaxPriceDraft] = useState(maxPrice);
  const [syncedMaxPrice, setSyncedMaxPrice] = useState(maxPrice);
  // Keep the price box in step when the URL changes (Reset, back button).
  if (syncedMaxPrice !== maxPrice) {
    setSyncedMaxPrice(maxPrice);
    setMaxPriceDraft(maxPrice);
  }

  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [radiusKm, setRadiusKm] = useState('');
  const [geoError, setGeoError] = useState<string>();
  const [limit, setLimit] = useState(PAGE);

  const [chat, setChat] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string>();
  const [chatResult, setChatResult] = useState<ChatResult>();

  /** Change one filter in the URL; an empty value removes it. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    setLimit(PAGE);
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  }

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (category) qs.set('category', category);
  if (type) qs.set('type', type);
  if (urgent) qs.set('urgent', 'true');
  if (maxPrice) qs.set('maxPrice', maxPrice);
  if (coords) {
    qs.set('lat', String(coords.lat));
    qs.set('lng', String(coords.lng));
    if (radiusKm) qs.set('radiusKm', radiusKm);
  }
  qs.set('limit', String(limit));
  const feed = useApi<{ results: Listing[] }>(`/search?${qs.toString()}`);
  const results = feed.data?.results;

  function locate() {
    setGeoError(undefined);
    if (coords) {
      setCoords(undefined);
      setRadiusKm('');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Could not get your location. Allow location access and try again.'),
    );
  }

  function reset() {
    setCoords(undefined);
    setRadiusKm('');
    setLimit(PAGE);
    router.replace('/search', { scroll: false });
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!chat.trim()) return;
    setChatBusy(true);
    setChatError(undefined);
    try {
      const chatParams = new URLSearchParams({ q: chat });
      if (coords) {
        chatParams.set('lat', String(coords.lat));
        chatParams.set('lng', String(coords.lng));
      }
      setChatResult(await call<ChatResult>(`/search/chat?${chatParams.toString()}`));
    } catch (err) {
      setChatError((err as Error).message);
    } finally {
      setChatBusy(false);
    }
  }

  const chatChips = chatResult
    ? Object.entries(chatResult.filters).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      )
    : [];

  const chip = (active: boolean) =>
    `rounded-[10px] bg-accent px-5 py-2 text-sm font-medium text-black shadow-button transition hover:brightness-95 ${
      active ? 'ring-2 ring-brand-700 ring-offset-2 ring-offset-cream' : ''
    }`;

  const filtered = Boolean(q || category || type || urgent || maxPrice || coords);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 className="text-4xl sm:text-[45px]">{q ? `Results for “${q}”` : 'Search'}</h1>
        {results && (
          <p className="text-sm text-muted">
            {results.length === 0
              ? 'No listings'
              : `${results.length}${results.length === limit ? '+' : ''} listing${results.length === 1 ? '' : 's'}`}
          </p>
        )}
      </div>

      <Card className="space-y-3">
        <form onSubmit={ask} className="flex flex-wrap gap-2">
          <Input
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            placeholder={'Ask in plain words, e.g. "nasi gratis hari ini"'}
            className="min-w-60 flex-1"
            aria-label="Conversational search"
          />
          <Button type="submit" variant="brand" disabled={chatBusy || !user}>
            {chatBusy ? 'Thinking…' : 'Ask AI'}
          </Button>
        </form>
        {!user && (
          <p className="text-xs text-muted">
            <Link href="/login" className="font-semibold underline">
              Log in
            </Link>{' '}
            to use conversational search.
          </p>
        )}
        {chatError && <Alert>{chatError}</Alert>}
        {chatResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <span className="text-muted">Understood as:</span>
              {chatChips.map(([k, v]) => (
                <Badge key={k} tone="brand">
                  {humanize(k)}: {String(v)}
                </Badge>
              ))}
              <button
                className="ml-2 text-xs underline"
                onClick={() => setChatResult(undefined)}
                type="button"
              >
                clear
              </button>
            </div>
            {chatResult.results.length === 0 ? (
              <p className="text-sm text-muted">Nothing matched that request.</p>
            ) : (
              <div className={listingGrid}>
                {chatResult.results.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Filter chips: the yellow bar from the Figma "Feeds" screen. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={type === c.value}
              onClick={() => setParam('type', c.value)}
              className={chip(type === c.value)}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={urgent}
            onClick={() => setParam('urgent', urgent ? '' : 'true')}
            className={chip(urgent)}
          >
            Urgent only
          </button>
          <button
            type="button"
            aria-pressed={Boolean(coords)}
            onClick={locate}
            className={chip(Boolean(coords))}
          >
            {coords ? 'Near me ✓' : 'Use my location'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam('maxPrice', maxPriceDraft);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <Select
            value={category}
            onChange={(e) => setParam('category', e.target.value)}
            className="max-w-48 bg-surface capitalize"
            aria-label="Category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
          {coords && (
            <Select
              value={radiusKm}
              onChange={(e) => {
                setRadiusKm(e.target.value);
                setLimit(PAGE);
              }}
              className="max-w-48 bg-surface"
              aria-label="Radius"
            >
              <option value="">Any distance</option>
              {[1, 3, 5, 10].map((r) => (
                <option key={r} value={r}>
                  within {r} km
                </option>
              ))}
            </Select>
          )}
          <Input
            value={maxPriceDraft}
            onChange={(e) => setMaxPriceDraft(e.target.value)}
            type="number"
            min={0}
            placeholder="Max Rp"
            className="max-w-36 bg-surface"
            aria-label="Max price"
          />
          <Button type="submit" variant="secondary" className="bg-surface">
            Apply
          </Button>
          {filtered && (
            <Button type="button" variant="secondary" className="bg-surface" onClick={reset}>
              Reset
            </Button>
          )}
        </form>
        {geoError && <Alert>{geoError}</Alert>}
      </div>

      {feed.error && <Alert>Could not load listings: {feed.error}</Alert>}
      {!results && !feed.error && <LoadingBlock label="Searching…" className="min-h-64" />}
      {results?.length === 0 && (
        <EmptyState title="No available food matches.">
          <p>Try other words, widen the distance or remove a filter.</p>
          {filtered && (
            <Button type="button" variant="secondary" onClick={reset}>
              Clear all filters
            </Button>
          )}
        </EmptyState>
      )}
      {results && results.length > 0 && (
        <div className={`${listingGrid} ${feed.loading ? 'opacity-60' : ''}`}>
          {results.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
      {results && results.length === limit && limit < MAX_LIMIT && (
        <div className="text-center">
          <Button
            type="button"
            variant="secondary"
            className="bg-surface"
            onClick={() => setLimit((n) => Math.min(n + PAGE, MAX_LIMIT))}
          >
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
