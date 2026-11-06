'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingCard } from '@/features/listings/listing-card';
import { ListingGrid, ProfileHeader, ProfileTabs, type ProfileTab } from '@/features/profile';
import { RatingPanel } from '@/features/reviews';
import type { Listing, PublicUser, ReviewSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Public profile ("review (non penjual)" in Figma): a user's live listings and ratings. */
export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const profile = useApi<{ user: PublicUser; listings: Listing[] }>(`/users/${id}/listings`);
  const reviews = useApi<ReviewSummary>(`/users/${id}/reviews`);
  const [tab, setTab] = useState<ProfileTab>('listing');

  if (profile.error) return <Alert>{profile.error}</Alert>;
  if (!profile.data) return <Loading />;

  const { user, listings } = profile.data;
  const isMe = me?.id === user.id;
  const average = reviews.data?.average;
  const subtitle =
    reviews.data &&
    (average != null
      ? `★ ${average.toFixed(1)} · ${reviews.data.total} rating${reviews.data.total === 1 ? '' : 's'}`
      : 'No ratings yet');

  return (
    <div className="space-y-6">
      <ProfileHeader
        name={user.name}
        avatarUrl={user.avatarUrl}
        subtitle={subtitle}
        action={
          isMe && (
            <Link
              href="/profile"
              className="rounded-[10px] bg-cream px-4 py-2 text-sm font-medium text-ink hover:bg-sand"
            >
              Edit your profile
            </Link>
          )
        }
      />

      <ProfileTabs tab={tab} onChange={setTab} />
      <div role="tabpanel">
        {tab === 'listing' ? (
          listings.length === 0 ? (
            <p className="rounded-[20px] bg-white p-6 text-center text-muted shadow-card">
              {user.name} has nothing listed right now.
            </p>
          ) : (
            <ListingGrid>
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} cartable={!isMe} />
              ))}
            </ListingGrid>
          )
        ) : reviews.error ? (
          <Alert>{reviews.error}</Alert>
        ) : reviews.data ? (
          <RatingPanel summary={reviews.data} />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}
