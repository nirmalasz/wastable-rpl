'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Input, Loading, Select } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard } from '@/features/listings/listing-card';
import { humanize } from '@/lib/format';
import type { Listing, SearchFilters } from '@/lib/types';
import { useApi } from '@/lib/use-api';

interface Filters {
  type: string;
  urgent: boolean;
  maxPrice: string;
  radiusKm: string;
}
const EMPTY: Filters = { type: '', urgent: false, maxPrice: '', radiusKm: '' };

const TYPE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'FREE', label: 'Free' },
  { value: 'SELL', label: 'For sale' },
  { value: 'EXCHANGE', label: 'Exchange' },
];

interface ChatResult {
  filters: SearchFilters;
  results: Listing[];
  remainingAiRequests: number;
}

const grid = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

/**
 * Browse feed with filters (FR-6) and the conversational Discovery Agent search (FR-17).
 * The text query and category come from the URL (top search bar, Food Categories).
 */
export function Feed() {
  const { user, call } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [maxPriceDraft, setMaxPriceDraft] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [geoError, setGeoError] = useState<string>();

  const [chat, setChat] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string>();
  const [chatResult, setChatResult] = useState<ChatResult>();

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (category) qs.set('category', category);
  if (filters.type) qs.set('type', filters.type);
  if (filters.urgent) qs.set('urgent', 'true');
  if (filters.maxPrice) qs.set('maxPrice', filters.maxPrice);
  if (coords) {
    qs.set('lat', String(coords.lat));
    qs.set('lng', String(coords.lng));
    if (filters.radiusKm) qs.set('radiusKm', filters.radiusKm);
  }
  const feed = useApi<{ results: Listing[] }>(`/search?${qs.toString()}`);

  function locate() {
    setGeoError(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Could not get your location. Allow location access and try again.'),
    );
  }

  function reset() {
    setFilters(EMPTY);
    setMaxPriceDraft('');
    router.push(pathname);
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

  const active = [
    q && `"${q}"`,
    category && humanize(category),
    filters.maxPrice && `≤ Rp ${filters.maxPrice}`,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
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
              <div className={grid}>
                {chatResult.results.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Filter chips: the yellow bar from the Figma "Feeds" screen. */}
      <div className="flex flex-wrap items-center gap-3">
        {TYPE_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={filters.type === c.value}
            onClick={() => setFilters({ ...filters, type: c.value })}
            className={chip(filters.type === c.value)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={filters.urgent}
          onClick={() => setFilters({ ...filters, urgent: !filters.urgent })}
          className={chip(filters.urgent)}
        >
          Urgent only
        </button>
        <button type="button" onClick={locate} className={chip(Boolean(coords))}>
          {coords ? 'Near me ✓' : 'Use my location'}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...filters, maxPrice: maxPriceDraft });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          value={maxPriceDraft}
          onChange={(e) => setMaxPriceDraft(e.target.value)}
          type="number"
          min={0}
          placeholder="Max Rp"
          className="max-w-40 bg-surface"
          aria-label="Max price"
        />
        {coords && (
          <Select
            value={filters.radiusKm}
            onChange={(e) => setFilters({ ...filters, radiusKm: e.target.value })}
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
        <Button type="submit" variant="secondary" className="bg-surface">
          Apply
        </Button>
        <Button type="button" variant="secondary" className="bg-surface" onClick={reset}>
          Reset
        </Button>
        {active.length > 0 && (
          <span className="flex flex-wrap gap-1 text-sm">
            {active.map((a) => (
              <Badge key={String(a)} tone="brand">
                {a}
              </Badge>
            ))}
          </span>
        )}
      </form>
      {geoError && <Alert>{geoError}</Alert>}

      {feed.error && <Alert>Could not load listings: {feed.error}</Alert>}
      {feed.loading && !feed.data && <Loading />}
      {feed.data && feed.data.results.length === 0 && (
        <p className="text-sm text-muted">
          No available food matches. Try widening the distance or removing a filter.
        </p>
      )}
      <div className={grid}>
        {feed.data?.results.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
