import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/" className="text-brand-700 underline">
        Back to home
      </Link>
    </div>
  );
}
