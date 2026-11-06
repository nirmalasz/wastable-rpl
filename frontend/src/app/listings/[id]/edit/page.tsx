'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { ListingForm } from '@/features/listings/listing-form';
import { humanize } from '@/lib/format';
import type { ListingDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Owner-only: the create-listing form, prefilled, saving with PATCH. */
function EditListing({ id }: { id: string }) {
  const { token } = useAuth();
  const detail = useApi<ListingDetail>(`/listings/${id}`, token);

  if (detail.error) return <Alert>{detail.error}</Alert>;
  if (!detail.data) return <Loading />;
  const { listing, isOwner } = detail.data;

  if (!isOwner) return <Alert>Only the seller can edit this listing.</Alert>;
  // The API only accepts edits while nobody holds a claim and the item is still live.
  if (listing.status !== 'AVAILABLE') {
    return (
      <Alert kind="info">
        This listing is {humanize(listing.status)} and can no longer be edited.{' '}
        <Link href={`/listings/${id}`} className="underline">
          Back to listing
        </Link>
      </Alert>
    );
  }
  return <ListingForm key={listing.id} listing={listing} />;
}

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireAuth>{() => <EditListing id={id} />}</RequireAuth>;
}
