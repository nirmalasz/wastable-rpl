'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Input, Loading, Select } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard } from '@/features/listings/listing-card';
import { humanize } from '@/lib/format';
import { CATEGORIES, type Listing, type SearchFilters } from '@/lib/types';
import { useApi } from '@/lib/use-api';

interface Filters {
  q: string;
  category: string;
  type: string;
  urgent: boolean;
  maxPrice: string;
  radiusKm: string;
}
const EMPTY: Filters = { q: '', category: '', type: '', urgent: false, maxPrice: '', radiusKm: '' };

interface ChatResult {
  filters: SearchFilters;
  results: Listing[];
  remainingAiRequests: number;
}

/** Browse feed with filters (FR-6) and the conversational Discovery Agent search (FR-17). */
export function Feed() {
  const { user, call } = useAuth();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [geoError, setGeoError] = useState<string>();

  const [chat, setChat] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string>();
  const [chatResult, setChatResult] = useState<ChatResult>();

  const qs = new URLSearchParams();
  if (applied.q) qs.set('q', applied.q);
  if (applied.category) qs.set('category', applied.category);
  if (applied.type) qs.set('type', applied.type);
  if (applied.urgent) qs.set('urgent', 'true');
  if (applied.maxPrice) qs.set('maxPrice', applied.maxPrice);
  if (coords) {
    qs.set('lat', String(coords.lat));
    qs.set('lng', String(coords.lng));
    if (applied.radiusKm) qs.set('radiusKm', applied.radiusKm);
  }
  const feed = useApi<{ results: Listing[] }>(`/search?${qs.toString()}`);

  function locate() {
    setGeoError(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Could not get your location. Allow location access and try again.'),
    );
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!chat.trim()) return;
    setChatBusy(true);
    setChatError(undefined);
    try {
      const params = new URLSearchParams({ q: chat });
      if (coords) {
        params.set('lat', String(coords.lat));
        params.set('lng', String(coords.lng));
      }
      setChatResult(await call<ChatResult>(`/search/chat?${params.toString()}`));
    } catch (err) {
      setChatError((err as Error).message);
    } finally {
      setChatBusy(false);
    }
  }

  const chips = chatResult
    ? Object.entries(chatResult.filters).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
      )
    : [];

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <form onSubmit={ask} className="flex flex-wrap gap-2">
          <Input
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            placeholder={'Ask in plain words, e.g. "nasi gratis hari ini"'}
            className="min-w-60 flex-1"
            aria-label="Conversational search"
          />
          <Button type="submit" disabled={chatBusy || !user}>
            {chatBusy ? 'Thinking…' : 'Ask AI'}
          </Button>
        </form>
        {!user && (
          <p className="text-xs text-slate-500">
            <Link href="/login" className="underline">
              Log in
            </Link>{' '}
            to use conversational search.
          </p>
        )}
        {chatError && <Alert>{chatError}</Alert>}
        {chatResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <span className="text-slate-500">Understood as:</span>
              {chips.map(([k, v]) => (
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
              <p className="text-sm text-slate-500">Nothing matched that request.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {chatResult.results.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(draft);
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Input
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          placeholder="Search food…"
          className="min-w-48 flex-1"
          aria-label="Search"
        />
        <Select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="w-auto"
          aria-label="Category"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
        </Select>
        <Select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          className="w-auto"
          aria-label="Type"
        >
          <option value="">Buy / exchange / free</option>
          <option value="SELL">For sale</option>
          <option value="EXCHANGE">Exchange</option>
          <option value="FREE">Free</option>
        </Select>
        <Input
          value={draft.maxPrice}
          onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
          type="number"
          min={0}
          placeholder="Max Rp"
          className="w-28"
          aria-label="Max price"
        />
        {coords && (
          <Select
            value={draft.radiusKm}
            onChange={(e) => setDraft({ ...draft, radiusKm: e.target.value })}
            className="w-auto"
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
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={draft.urgent}
            onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })}
          />
          Urgent only
        </label>
        <Button type="submit">Search</Button>
        <Button type="button" variant="secondary" onClick={locate}>
          {coords ? 'Location set' : 'Use my location'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDraft(EMPTY);
            setApplied(EMPTY);
          }}
        >
          Reset
        </Button>
      </form>
      {geoError && <Alert>{geoError}</Alert>}

      {feed.error && <Alert>Could not load listings: {feed.error}</Alert>}
      {feed.loading && !feed.data && <Loading />}
      {feed.data && feed.data.results.length === 0 && (
        <p className="text-sm text-slate-500">No available food matches. Try changing filters.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {feed.data?.results.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
