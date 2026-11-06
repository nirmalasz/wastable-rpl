'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { ImageUpload } from '@/components/image-upload';
import { RequireAuth } from '@/components/require-auth';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Loading,
  Select,
  Textarea,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard } from '@/features/listings/listing-card';
import { RatingPanel } from '@/features/reviews';
import { formatDateTime, humanize } from '@/lib/format';
import type { Appeal, MyListing, ReviewSummary, User } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Tab = 'listing' | 'rating';

/** "Listing   Rating" tabs from the Figma profile; the active one gets the grey underline. */
function ProfileTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div role="tablist" className="flex justify-end gap-8 sm:gap-12">
      {(['listing', 'rating'] as const).map((t) => (
        <button
          key={t}
          role="tab"
          type="button"
          aria-selected={tab === t}
          onClick={() => onChange(t)}
          className="flex flex-col items-center font-display text-3xl text-black capitalize sm:text-[40px]"
        >
          <span className="leading-[1.65]">{t}</span>
          <span
            aria-hidden
            className={`h-3 w-[142px] max-w-full ${tab === t ? 'bg-[#b3b3b3]' : 'bg-transparent'}`}
          />
        </button>
      ))}
    </div>
  );
}

function ListingTab() {
  const { token } = useAuth();
  const mine = useApi<{ listings: MyListing[] }>('/listings/mine', token);
  if (mine.error) return <Alert>{mine.error}</Alert>;
  if (!mine.data) return <Loading />;
  const visible = mine.data.listings.filter((l) => l.status !== 'REMOVED');
  if (visible.length === 0) {
    return (
      <p className="rounded-[20px] bg-white p-6 text-center text-muted shadow-card">
        You have no listings yet.{' '}
        <Link href="/listings/new" className="text-brand-700 underline">
          Post food
        </Link>
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-7">
      {visible.map((l) => (
        <ListingCard key={l.id} listing={l} cartable={false} />
      ))}
    </div>
  );
}

function RatingTab({ userId }: { userId: string }) {
  const reviews = useApi<ReviewSummary>(`/users/${userId}/reviews`);
  if (reviews.error) return <Alert>{reviews.error}</Alert>;
  if (!reviews.data) return <Loading />;
  return <RatingPanel summary={reviews.data} />;
}

function Profile({ user }: { user: User }) {
  const { token, call, refreshUser } = useAuth();
  const appeals = useApi<{ appeals: Appeal[] }>(
    user.status === 'SUSPENDED' ? '/appeals/mine' : null,
    token,
  );
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(
    user.homeLat !== null && user.homeLng !== null
      ? { lat: user.homeLat, lng: user.homeLng }
      : null,
  );
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [tab, setTab] = useState<Tab>('listing');
  const [editing, setEditing] = useState(false);

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => setHome({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setNotice({ kind: 'error', text: 'Could not get your location.' }),
    );
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await call('/users/me', {
        method: 'PATCH',
        body: {
          name: String(form.get('name')),
          locationRadiusKm: Number(form.get('radius')),
          contactPreference: String(form.get('contact') ?? '') || null,
          homeLat: home?.lat ?? null,
          homeLng: home?.lng ?? null,
        },
      });
      setNotice({ kind: 'success', text: 'Profile saved.' });
      refreshUser();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    }
  }

  async function saveAvatar(url: string | null) {
    try {
      await call('/users/me', { method: 'PATCH', body: { avatarUrl: url } });
      setNotice({
        kind: 'success',
        text: url ? 'Profile photo updated.' : 'Profile photo removed.',
      });
      refreshUser();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    }
  }

  async function appeal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason'));
    try {
      await call('/appeals', { body: { reason } });
      setNotice({ kind: 'success', text: 'Appeal submitted. An admin will review it.' });
      appeals.reload();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card from the Figma profile: big avatar overlapping the bottom edge. */}
      <section className="relative mb-20 rounded-[17px] bg-white px-6 pt-24 pb-6 shadow-card sm:mb-[105px] sm:px-14 sm:pt-[150px] sm:pb-8">
        <div className="flex flex-wrap items-end gap-4 sm:gap-7">
          <div className="-mb-16 rounded-full bg-white sm:-mb-[81px]">
            <span className="block sm:hidden">
              <Avatar url={user.avatarUrl} name={user.name} size={128} />
            </span>
            <span className="hidden sm:block">
              <Avatar url={user.avatarUrl} name={user.name} size={252} />
            </span>
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-3xl leading-tight text-black sm:text-[40px]">
              {user.name}
            </h1>
            <p className="truncate text-xl text-black sm:text-[34px] sm:leading-tight">
              @{user.email.split('@')[0]}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            aria-expanded={editing}
            onClick={() => setEditing((e) => !e)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6"
          >
            {editing ? 'Close settings' : 'Edit profile'}
          </Button>
        </div>
      </section>

      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      {editing && (
        <Card className="mx-auto max-w-xl space-y-3">
          <ImageUpload
            label="Profile photo"
            shape="round"
            value={user.avatarUrl}
            onChange={saveAvatar}
          />
          <form onSubmit={save} className="space-y-3">
            <p className="text-sm text-muted">
              {user.email} ·{' '}
              <Badge tone={user.status === 'ACTIVE' ? 'brand' : 'danger'}>
                {humanize(user.status)}
              </Badge>
            </p>
            <Field label="Name">
              <Input name="name" defaultValue={user.name} required maxLength={80} />
            </Field>
            <Field
              label="Contact preference"
              hint="Shown to your trade partner, e.g. WhatsApp number."
            >
              <Input name="contact" defaultValue={user.contactPreference ?? ''} maxLength={200} />
            </Field>
            <Field
              label="Reminder radius"
              hint="Get urgent-item reminders from sellers within this distance."
            >
              <Select name="radius" defaultValue={user.locationRadiusKm}>
                {[1, 2, 3, 5, 10, 20].map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-3 text-sm">
              <Button type="button" variant="secondary" onClick={locate}>
                {home ? 'Update my location' : 'Set my location'}
              </Button>
              {home && (
                <span className="text-muted">
                  {home.lat.toFixed(3)}, {home.lng.toFixed(3)}
                </span>
              )}
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {user.status === 'SUSPENDED' && (
        <Card className="mx-auto max-w-xl space-y-3">
          <h2 className="text-xl">Appeal your suspension</h2>
          <form onSubmit={appeal} className="space-y-3">
            <Field label="Why should the suspension be lifted?">
              <Textarea name="reason" rows={3} required minLength={10} maxLength={1000} />
            </Field>
            <Button type="submit">Submit appeal</Button>
          </form>
          {appeals.data?.appeals.map((a) => (
            <p key={a.id} className="text-sm text-muted">
              {formatDateTime(a.createdAt)} · <Badge>{humanize(a.status)}</Badge>
            </p>
          ))}
        </Card>
      )}

      <div className="space-y-6">
        <ProfileTabs tab={tab} onChange={setTab} />
        <div role="tabpanel">
          {tab === 'listing' ? <ListingTab /> : <RatingTab userId={user.id} />}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return <RequireAuth>{(user) => <Profile key={user.id} user={user} />}</RequireAuth>;
}
