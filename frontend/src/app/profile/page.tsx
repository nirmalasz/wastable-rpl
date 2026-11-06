'use client';

import { useState, type FormEvent } from 'react';
import { ImageUpload } from '@/components/image-upload';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formatDateTime, humanize } from '@/lib/format';
import type { Appeal, User } from '@/lib/types';
import { useApi } from '@/lib/use-api';

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
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-4xl">Your profile</h1>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <Card className="space-y-3">
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

      {user.status === 'SUSPENDED' && (
        <Card className="space-y-3">
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
    </div>
  );
}

export default function ProfilePage() {
  return <RequireAuth>{(user) => <Profile key={user.id} user={user} />}</RequireAuth>;
}
