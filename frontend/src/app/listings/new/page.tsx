'use client';

import { RequireAuth } from '@/components/require-auth';
import { ListingForm } from '@/features/listings/listing-form';

export default function NewListingPage() {
  return <RequireAuth>{() => <ListingForm />}</RequireAuth>;
}
