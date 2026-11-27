import type { Metadata } from 'next';
import Link from 'next/link';
import { TERMS, TERMS_UPDATED, TERMS_VERSION } from '@/features/terms/content';

export const metadata: Metadata = {
  title: 'Terms & SOP · WASTABLE',
  description: 'How to use WASTABLE: rules for posting, claiming, payment, safety and reviews.',
};

/**
 * Terms of use and SOP. A plain reading page (no left rail), linked from the register form
 * and the footer. The text lives in features/terms/content.ts.
 */
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 py-2 md:py-6">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-[45px]">Terms &amp; SOP</h1>
        <p className="text-sm text-muted">
          Last updated {TERMS_UPDATED} · version {TERMS_VERSION}
        </p>
      </header>

      <nav
        aria-label="On this page"
        className="rounded-[20px] bg-white p-5 shadow-card sm:px-8 sm:py-6"
      >
        <p className="text-sm font-medium text-ink">On this page</p>
        <ol className="mt-2 grid list-inside list-decimal gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {TERMS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-brand-700 underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-4">
        {TERMS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-4 space-y-3 rounded-[20px] bg-white p-5 shadow-card sm:px-8 sm:py-6"
          >
            <h2 className="text-2xl sm:text-3xl">
              {i + 1}. {s.title}
            </h2>
            {s.intro && <p className="text-base text-ink">{s.intro}</p>}
            <ul className="list-disc space-y-2 pl-5 text-base text-ink marker:text-brand-500">
              {s.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-brand-700 underline">
          Back to home
        </Link>
        <Link
          href="/register"
          className="rounded-[10px] bg-accent px-5 py-2 text-sm font-bold italic text-black shadow-button hover:brightness-95"
        >
          Create an account
        </Link>
      </div>
    </article>
  );
}
