'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ImageUpload } from '@/components/image-upload';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { toLocalInput, humanize } from '@/lib/format';
import { CATEGORIES, type Listing, type ListingDraft, type ListingType } from '@/lib/types';

interface FormState {
  title: string;
  description: string;
  category: string;
  quantity: string;
  listingType: ListingType;
  price: string;
  expiry: string;
  pickupArea: string;
  photoUrl: string;
  pickupLat: number | null;
  pickupLng: number | null;
}

const EMPTY: FormState = {
  title: '',
  description: '',
  category: 'cooked-meal',
  quantity: '1',
  listingType: 'FREE',
  price: '',
  expiry: '',
  pickupArea: '',
  photoUrl: '',
  pickupLat: null,
  pickupLng: null,
};

const fromListing = (l: Listing): FormState => ({
  title: l.title,
  description: l.description ?? '',
  category: l.category,
  quantity: String(l.quantity),
  listingType: l.listingType,
  price: l.listingType === 'SELL' ? String(l.price) : '',
  expiry: toLocalInput(l.expiryDate),
  pickupArea: l.pickupArea,
  photoUrl: l.photoUrl ?? '',
  // Exact coordinates are never sent to the browser; only overwrite them if the seller asks.
  pickupLat: null,
  pickupLng: null,
});

/**
 * The "Post Listing" screen. Without `listing` it creates a new one; with `listing` the same
 * form edits it in place (PATCH), so sellers get the same fields and AI helper either way.
 */
export function ListingForm({ listing }: { listing?: Listing }) {
  const editing = Boolean(listing);
  const { call } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => (listing ? fromListing(listing) : EMPTY));
  const [freeText, setFreeText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [pending, setPending] = useState<string>();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function extract() {
    setExtracting(true);
    setError(undefined);
    setInfo(undefined);
    try {
      const res = await call<{ draft: ListingDraft; remainingAiRequests: number }>(
        '/listings/extract',
        { body: { text: freeText || undefined, photoUrl: form.photoUrl || undefined } },
      );
      const d = res.draft;
      setForm((f) => ({
        ...f,
        title: d.title,
        description: d.description ?? f.description,
        category: d.category,
        quantity: String(d.quantity),
        listingType: d.listingType ?? f.listingType,
        price: d.price ? String(d.price) : f.price,
        expiry: d.expiryDate ? toLocalInput(d.expiryDate) : f.expiry,
      }));
      setInfo(
        `${d.source === 'AI' ? 'Draft created by AI' : 'AI is unavailable, so a simple draft was made from your text'}. ` +
          `Review and edit it before posting. (${res.remainingAiRequests} AI requests left today)`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const body = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      quantity: Number(form.quantity),
      listingType: form.listingType,
      price: form.listingType === 'SELL' ? Number(form.price) : 0,
      expiryDate: new Date(form.expiry).toISOString(),
      pickupArea: form.pickupArea,
      photoUrl: form.photoUrl || null,
      // On edit, leave the saved location alone unless a new one was captured.
      ...((!editing || form.pickupLat !== null) && {
        pickupLat: form.pickupLat,
        pickupLng: form.pickupLng,
      }),
    };
    try {
      if (listing) {
        const res = await call<{ listing: { id: string; status: string } }>(
          `/listings/${listing.id}`,
          { method: 'PATCH', body },
        );
        if (res.listing.status === 'UNDER_REVIEW') {
          setPending('Your changes are pending admin review before the listing is visible again.');
        } else router.push(`/listings/${listing.id}`);
        return;
      }
      const res = await call<{ listing: { id: string }; message?: string }>('/listings', { body });
      if (res.message) setPending(res.message);
      else router.push(`/listings/${res.listing.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <Alert kind="info">
        {pending}{' '}
        <Link href="/dashboard" className="underline">
          Go to dashboard
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="sr-only">{editing ? `Edit ${listing?.title}` : 'Post surplus food'}</h1>
      <div className="grid gap-6 lg:grid-cols-[434px_1fr]">
        {/* Left column: photo and the AI helper */}
        <div className="space-y-5">
          <Card>
            <ImageUpload
              label="Photo (optional)"
              value={form.photoUrl || null}
              onChange={(url) => set('photoUrl', url ?? '')}
            />
          </Card>
          <Card className="space-y-3">
            <Field
              label="Describe it in your own words (optional)"
              hint="Example: 5 nasi kotak ayam sisa katering, Rp 8.000, habis malam ini. The AI fills in the form."
            >
              <Textarea rows={3} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
            </Field>
            <Button
              type="button"
              variant="brand"
              onClick={extract}
              disabled={extracting || (!freeText && !form.photoUrl)}
              className="w-full"
            >
              {extracting ? 'Reading…' : 'Fill the form with AI'}
            </Button>
            {info && <Alert kind="info">{info}</Alert>}
          </Card>
        </div>

        {/* Right column: Product Description */}
        <Card className="space-y-4 sm:p-8">
          <h2 className="text-3xl text-black">Product Description</h2>
          <Field label="Product Name">
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              maxLength={120}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Offer type">
              <Select
                value={form.listingType}
                onChange={(e) => set('listingType', e.target.value as ListingType)}
              >
                <option value="FREE">Give away (free)</option>
                <option value="SELL">Sell</option>
                <option value="EXCHANGE">Exchange</option>
              </Select>
            </Field>
            {form.listingType === 'SELL' && (
              <Field label="Price (Rp)">
                <Input
                  type="number"
                  min={1}
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  required
                />
              </Field>
            )}
            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                required
              />
            </Field>
            <Field label="Best before / expiration date">
              <Input
                type="datetime-local"
                value={form.expiry}
                onChange={(e) => set('expiry', e.target.value)}
                required
              />
            </Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pickup area" hint="Shown publicly. Do not enter your exact address.">
              <Input
                value={form.pickupArea}
                onChange={(e) => set('pickupArea', e.target.value)}
                required
                maxLength={200}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={2000}
            />
          </Field>
          <div className="space-y-1 text-sm">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    set('pickupLat', pos.coords.latitude);
                    set('pickupLng', pos.coords.longitude);
                  },
                  () => setError('Could not get your location. You can still post without it.'),
                )
              }
            >
              {form.pickupLat !== null
                ? 'Location saved'
                : editing
                  ? 'Update location to where I am now'
                  : 'Use my location for distance search'}
            </Button>
            <p className="text-xs text-muted">
              Lets nearby buyers find this by distance. Exact coordinates are never shown.
            </p>
          </div>
          {error && <Alert>{error}</Alert>}
        </Card>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {listing && (
          <Link href={`/listings/${listing.id}`} className="text-sm text-muted underline">
            Cancel
          </Link>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="w-full px-16 py-3 text-lg uppercase sm:w-auto"
        >
          {busy ? (editing ? 'Saving…' : 'Posting…') : editing ? 'Save changes' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
