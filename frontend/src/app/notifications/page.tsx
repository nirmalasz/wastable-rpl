'use client';

import { RequireAuth } from '@/components/require-auth';
import { Alert, Button, Card, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formatDateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { useApi } from '@/lib/use-api';

function Notifications() {
  const { token, call } = useAuth();
  const { data, error, loading, reload } = useApi<{
    notifications: Notification[];
    unreadCount: number;
  }>('/notifications', token);

  async function markRead(id: string) {
    await call(`/notifications/${id}/read`, { method: 'PATCH' });
    reload();
  }

  async function markAll() {
    await call('/notifications/read-all', { method: 'POST' });
    reload();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Notifications</h1>
        {data && data.unreadCount > 0 && (
          <Button variant="secondary" onClick={markAll}>
            Mark all as read
          </Button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}
      {data?.notifications.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
      {data?.notifications.map((n) => (
        <Card key={n.id} className={n.isRead ? 'opacity-70' : 'border-brand-500'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm">{n.message}</p>
              <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
            </div>
            {!n.isRead && (
              <Button variant="secondary" onClick={() => markRead(n.id)}>
                Mark read
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  return <RequireAuth>{() => <Notifications />}</RequireAuth>;
}
