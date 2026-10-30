import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { humanize, rupiah, timeLeft } from '@/lib/format';
import type { Listing } from '@/lib/types';

export function priceLabel(l: Pick<Listing, 'listingType' | 'price'>) {
  if (l.listingType === 'FREE') return 'Free';
  if (l.listingType === 'EXCHANGE') return 'Exchange';
  return rupiah(l.price);
}

export function ListingCard({ listing: l }: { listing: Listing }) {
  return (
    <Link href={`/listings/${l.id}`} className="block">
      <Card className="h-full space-y-2 overflow-hidden transition hover:border-brand-500">
        {l.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.photoUrl}
            alt=""
            loading="lazy"
            className="-mx-4 -mt-4 mb-2 aspect-video w-[calc(100%+2rem)] max-w-none object-cover"
          />
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{l.title}</h3>
          <Badge tone="brand">{priceLabel(l)}</Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {l.isUrgent && <Badge tone="urgent">Urgent</Badge>}
          <Badge>{humanize(l.category)}</Badge>
          {l.dietFlags.map((f) => (
            <Badge key={f} tone="danger">
              contains {f}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-slate-600">
          {l.quantity} available · {l.pickupArea}
          {l.distanceKm != null && ` · ${l.distanceKm} km`}
        </p>
        <p className="text-xs text-slate-500">
          {timeLeft(l.expiryDate)}
          {l.sellerName && ` · ${l.sellerName}`}
          {l.sellerRating != null && ` ★ ${l.sellerRating.toFixed(1)}`}
        </p>
      </Card>
    </Link>
  );
}
