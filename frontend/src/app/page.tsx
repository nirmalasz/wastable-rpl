import { ApiStatus } from '@/components/api-status';

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Rescue surplus food near you</h1>
        <p className="text-slate-600">
          Buy, exchange, or give away food before it goes to waste. Feed, search, and listing pages
          will be built here.
        </p>
      </div>
      <ApiStatus />
    </section>
  );
}
