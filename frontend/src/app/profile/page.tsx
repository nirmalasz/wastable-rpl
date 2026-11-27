'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { RequireAuth } from '@/components/require-auth';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  Textarea,
} from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard } from '@/features/listings/listing-card';
import { ListingGrid, ProfileHeader, ProfileTabs, type ProfileTab } from '@/features/profile';
import { EditProfileModal } from '@/features/profile/edit-profile-modal';
import { RatingPanel } from '@/features/reviews';
import { formatDateTime, humanize } from '@/lib/format';
import type { Appeal, MyListing, ReviewSummary, User } from '@/lib/types';
import { useApi } from '@/lib/use-api';

function ListingTab() {
  const { token } = useAuth();
  const mine = useApi<{ listings: MyListing[] }>('/listings/mine', token);
  if (mine.error) return <Alert>{mine.error}</Alert>;
  if (!mine.data) return <LoadingBlock label="Loading listings…" className="min-h-64" />;
  const visible = mine.data.listings.filter((l) => l.status !== 'REMOVED');
  if (visible.length === 0) {
    return (
      <EmptyState title="You have no listings yet.">
        <Link href="/listings/new" className="text-brand-700 underline">
          Post food
        </Link>
      </EmptyState>
    );
  }
  return (
    <ListingGrid>
      {visible.map((l) => (
        <ListingCard key={l.id} listing={l} cartable={false} />
      ))}
    </ListingGrid>
  );
}

function RatingTab({ userId }: { userId: string }) {
  const reviews = useApi<ReviewSummary>(`/users/${userId}/reviews`);
  if (reviews.error) return <Alert>{reviews.error}</Alert>;
  if (!reviews.data) return <LoadingBlock className="min-h-64" />;
  return <RatingPanel summary={reviews.data} />;
}

function Profile({ user }: { user: User }) {
  const { token, call, logout } = useAuth();
  // /profile?tab=rating opens the Rating tab (used by "new review" notifications).
  const startOnRating = useSearchParams().get('tab') === 'rating';
  const appeals = useApi<{ appeals: Appeal[] }>(
    user.status === 'SUSPENDED' ? '/appeals/mine' : null,
    token,
  );
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [tab, setTab] = useState<ProfileTab>(startOnRating ? 'rating' : 'listing');
  const [editing, setEditing] = useState(false);

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
      <ProfileHeader
        name={user.name}
        avatarUrl={user.avatarUrl}
        subtitle={`@${user.email.split('@')[0]}`}
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-haspopup="dialog"
              onClick={() => {
                setNotice(undefined);
                setEditing(true);
              }}
            >
              Edit profile
            </Button>
            {/* Phones have no left rail, so logging out lives here. */}
            <Button type="button" variant="secondary" className="md:hidden" onClick={logout}>
              Log out
            </Button>
          </div>
        }
      />

      {editing && (
        <EditProfileModal
          user={user}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice({ kind: 'success', text: 'Profile saved.' });
          }}
        />
      )}

      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

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

      <ProfileTabs tab={tab} onChange={setTab} />
      <div role="tabpanel">
        {tab === 'listing' ? <ListingTab /> : <RatingTab userId={user.id} />}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      {(user) => (
        <Suspense fallback={<LoadingBlock className="min-h-[60vh]" />}>
          <Profile key={user.id} user={user} />
        </Suspense>
      )}
    </RequireAuth>
  );
}
