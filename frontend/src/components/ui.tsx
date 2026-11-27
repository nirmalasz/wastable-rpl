import { RecycleIcon } from './icons';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'brand' | 'soft' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'rounded-[10px] px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-accent font-bold italic text-black shadow-button hover:brightness-95',
        variant === 'brand' && 'bg-brand-500 text-white shadow-button hover:bg-brand-700',
        variant === 'soft' &&
          'bg-brand-300 font-medium italic text-black shadow-button hover:brightness-95',
        variant === 'secondary' && 'bg-cream text-ink hover:bg-sand',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-[10px] border border-transparent bg-cream px-3 py-2 text-sm text-ink placeholder:italic placeholder:text-black/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cx(inputClass, props.className)} />
);

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cx(inputClass, props.className)} />
);

export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cx(inputClass, props.className)} />
);

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-[10px] border px-3 py-2 text-sm',
        kind === 'error' && 'border-danger/30 bg-expiry/20 text-danger',
        kind === 'success' && 'border-brand-500/40 bg-brand-50 text-brand-700',
        kind === 'info' && 'border-sand bg-surface text-ink',
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'urgent' | 'brand' | 'danger';
}) {
  return (
    <span
      className={cx(
        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-cream text-ink',
        tone === 'urgent' && 'bg-urgent text-white',
        tone === 'brand' && 'bg-brand-50 text-brand-700',
        tone === 'danger' && 'bg-expiry/30 text-danger',
      )}
    >
      {children}
    </span>
  );
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('rounded-[20px] bg-white p-5 shadow-card', className)}>{children}</div>
);

/**
 * Loading indicators: a spinning recycle mark in brand green. Users who asked their device
 * for reduced motion see it standing still.
 */
function Spinner({ size }: { size: number }) {
  return (
    <RecycleIcon
      size={size}
      className="shrink-0 text-brand-500 animate-[spin_1.6s_linear_infinite] motion-reduce:animate-none"
    />
  );
}

/** Small inline "working" line, for places too small for a block (buttons, chat, guards). */
export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <Spinner size={20} />
      {children}
    </p>
  );
}

/**
 * Centered recycle spinner that holds the space of the content it replaces (a listing grid,
 * a list of rows, a whole page) so the layout does not jump when the data arrives.
 */
export function LoadingBlock({
  label = 'Loading…',
  className,
}: {
  label?: string;
  /** Height of the reserved space, e.g. "min-h-64". */
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cx('flex flex-col items-center justify-center gap-3 py-10', className)}
    >
      <Spinner size={48} />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

export const listingGrid = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

/** Friendly "nothing here" card with an optional action underneath. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[20px] bg-white p-8 text-center shadow-card">
      <p className="text-lg text-ink">{title}</p>
      {children && <div className="mt-2 space-y-3 text-sm text-muted">{children}</div>}
    </div>
  );
}
