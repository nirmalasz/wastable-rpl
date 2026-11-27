'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronRightIcon } from '@/components/icons';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Button, EmptyState, LoadingBlock } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { notificationHref, notificationLook } from '@/features/notifications';
import { formatDateTime, timeAgo } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** One notification. Tapping it marks it read and opens the page it is about, if any. */
function Row({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const look = notificationLook(n.type);
  const href = notificationHref(n);
  const actionable = Boolean(href) || !n.isRead;

  const body = (
    <>
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${look.tone}`}
      >
        {look.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm text-ink ${n.isRead ? '' : 'font-semibold'}`}>
          {n.message}
        </span>
        <span className="block text-xs text-muted" title={formatDateTime(n.createdAt)}>
          {timeAgo(n.createdAt)}
        </span>
      </span>
      {!n.isRead && (
        <span className="size-2.5 shrink-0 rounded-full bg-urgent">
          <span className="sr-only">Unread</span>
        </span>
      )}
      {href && <ChevronRightIcon size={18} className="shrink-0 text-muted" />}
    </>
  );

  const frame = `flex w-full items-center gap-3 rounded-[20px] p-4 text-left shadow-card sm:px-5 ${
    n.isRead ? 'bg-surface' : 'bg-white'
  }`;

  return (
    <li>
      {actionable ? (
        <button
          type="button"
          onClick={onOpen}
          className={`${frame} transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-500`}
        >
          {body}
        </button>
      ) : (
        <div className={frame}>{body}</div>
      )}
    </li>
  );
}

function Notifications() {
  const { token, call } = useAuth();
  const router = useRouter();
  const { data, error, reload } = useApi<{
    notifications: Notification[];
    unreadCount: number;
  }>('/notifications', token);
  const [actionError, setActionError] = useState<string>();

  async function open(n: Notification) {
    setActionError(undefined);
    const href = notificationHref(n);
    try {
      if (!n.isRead) await call(`/notifications/${n.id}/read`, { method: 'PATCH' });
    } catch (err) {
      // Still open the page; the notification simply stays unread.
      if (!href) setActionError((err as Error).message);
    }
    if (href) router.push(href);
    else reload();
  }

  async function markAll() {
    setActionError(undefined);
    try {
      await call('/notifications/read-all', { method: 'POST' });
    } catch (err) {
      setActionError((err as Error).message);
    }
    reload();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">Notifications</h1>
        {data && data.unreadCount > 0 && (
          <Button variant="secondary" className="bg-surface" onClick={markAll}>
            Mark all as read
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {!data && !error && <LoadingBlock label="Loading notifications…" className="min-h-64" />}
      {data?.notifications.length === 0 && (
        <EmptyState title="Nothing yet.">
          <p>Claims, messages, reviews and expiry reminders will show up here.</p>
        </EmptyState>
      )}
      {data && data.notifications.length > 0 && (
        <ul className="space-y-3">
          {data.notifications.map((n) => (
            <Row key={n.id} n={n} onOpen={() => open(n)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return <RequireAuth>{() => <Notifications />}</RequireAuth>;
}
