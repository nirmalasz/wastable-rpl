'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImageUpload } from '@/components/image-upload';
import { Alert, Badge, Button, Field, Input, Select } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { humanize } from '@/lib/format';
import type { User } from '@/lib/types';

interface Draft {
  name: string;
  contact: string;
  radius: number;
  avatarUrl: string | null;
  home: { lat: number; lng: number } | null;
}

const fromUser = (u: User): Draft => ({
  name: u.name,
  contact: u.contactPreference ?? '',
  radius: u.locationRadiusKm,
  avatarUrl: u.avatarUrl,
  home: u.homeLat !== null && u.homeLng !== null ? { lat: u.homeLat, lng: u.homeLng } : null,
});

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Edit-profile dialog. Nothing is sent until Save; closing with unsaved edits (Close,
 * Esc or the backdrop) asks before throwing them away.
 */
export function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { call, refreshUser } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [initial] = useState(() => fromUser(user));
  const [draft, setDraft] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const dirty = !same(draft, initial);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Also warn when leaving the page with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function requestClose() {
    if (dirty) setConfirming(true);
    else onClose();
  }

  function locate() {
    navigator.geolocation.getCurrentPosition(
      (pos) => set('home', { lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('Could not get your location.'),
    );
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.name.trim()) {
      setConfirming(false);
      return setError('Name is required.');
    }
    setSaving(true);
    setError(undefined);
    try {
      await call('/users/me', {
        method: 'PATCH',
        body: {
          name: draft.name.trim(),
          locationRadiusKm: draft.radius,
          contactPreference: draft.contact.trim() || null,
          avatarUrl: draft.avatarUrl,
          homeLat: draft.home?.lat ?? null,
          homeLng: draft.home?.lng ?? null,
        },
      });
      refreshUser();
      onSaved();
    } catch (err) {
      setConfirming(false);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-profile-title"
      // Esc fires "cancel": route it through the same unsaved-changes check.
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      // A click on the dialog element itself (not its content) is a backdrop click.
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-[20px] bg-white p-0 text-ink shadow-card backdrop:bg-black/40"
    >
      <form onSubmit={save} className="max-h-[85vh] space-y-4 overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-profile-title" className="text-2xl">
              Edit profile
            </h2>
            <p className="text-sm text-muted">
              {user.email} ·{' '}
              <Badge tone={user.status === 'ACTIVE' ? 'brand' : 'danger'}>
                {humanize(user.status)}
              </Badge>
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="rounded-full px-2 text-2xl leading-none text-muted hover:bg-cream"
          >
            ×
          </button>
        </div>

        {error && <Alert>{error}</Alert>}

        <ImageUpload
          label="Profile photo"
          shape="round"
          value={draft.avatarUrl}
          onChange={(url) => set('avatarUrl', url)}
        />
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            required
            maxLength={80}
          />
        </Field>
        <Field label="Contact preference" hint="Shown to your trade partner, e.g. WhatsApp number.">
          <Input
            value={draft.contact}
            onChange={(e) => set('contact', e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field
          label="Reminder radius"
          hint="Get urgent-item reminders from sellers within this distance."
        >
          <Select value={draft.radius} onChange={(e) => set('radius', Number(e.target.value))}>
            {[1, 2, 3, 5, 10, 20].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-3 text-sm">
          <Button type="button" variant="secondary" onClick={locate}>
            {draft.home ? 'Update my location' : 'Set my location'}
          </Button>
          {draft.home && (
            <span className="text-muted">
              {draft.home.lat.toFixed(3)}, {draft.home.lng.toFixed(3)}
            </span>
          )}
        </div>

        {confirming ? (
          <div role="alert" className="space-y-3 rounded-[14px] bg-expiry/20 p-4">
            <p className="text-sm font-medium text-danger">
              You have unsaved changes. Close without saving?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button type="button" variant="danger" onClick={onClose}>
                Discard changes
              </Button>
              <Button type="button" onClick={() => save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save and close'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={requestClose}>
              Close
            </Button>
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </form>
    </dialog>
  );
}
