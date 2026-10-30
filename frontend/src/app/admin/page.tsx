'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Button, Card, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formatDateTime, humanize } from '@/lib/format';
import type { Appeal, ModerationCase } from '@/lib/types';
import { useApi } from '@/lib/use-api';

function Admin() {
  const { token, call } = useAuth();
  const cases = useApi<{ cases: ModerationCase[] }>('/moderation/cases?status=OPEN', token);
  const appeals = useApi<{ appeals: Appeal[] }>('/appeals?status=PENDING', token);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string }>();

  async function run(fn: () => Promise<unknown>, success: string) {
    setNotice(undefined);
    try {
      await fn();
      setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      cases.reload();
      appeals.reload();
    }
  }

  const decideCase = (id: string, decision: 'DISMISS' | 'CONFIRM_VIOLATION') =>
    run(
      () => call(`/moderation/cases/${id}`, { method: 'PATCH', body: { decision } }),
      decision === 'DISMISS'
        ? 'Case dismissed, listing restored.'
        : 'Violation confirmed, listing removed.',
    );
  const decideAppeal = (id: string, decision: 'APPROVE' | 'REJECT') =>
    run(
      () => call(`/appeals/${id}`, { method: 'PATCH', body: { decision } }),
      `Appeal ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`,
    );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Moderation</h1>
      {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open cases ({cases.data?.cases.length ?? 0})</h2>
        {cases.error && <Alert>{cases.error}</Alert>}
        {cases.loading && !cases.data && <Loading />}
        {cases.data?.cases.length === 0 && (
          <p className="text-sm text-slate-500">Queue is empty.</p>
        )}
        {cases.data?.cases.map((c) => (
          <Card key={c.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/listings/${c.listingId}`} className="font-semibold hover:underline">
                {c.listingTitle}
              </Link>
              <div className="flex gap-1">
                <Badge>{humanize(c.source)}</Badge>
                <Badge tone="danger">seller has {c.sellerViolations} violation(s)</Badge>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Seller {c.sellerName} · {formatDateTime(c.createdAt)}
            </p>
            {c.listingDescription && <p className="text-sm">{c.listingDescription}</p>}
            {(c.aiFlags.length > 0 || c.aiRationale) && (
              <p className="rounded-md bg-slate-50 p-2 text-sm">
                <strong>AI suggestion:</strong> {c.aiFlags.join(', ') || '–'}
                {c.aiRationale && ` · ${c.aiRationale}`}
              </p>
            )}
            {c.reports.map((r, i) => (
              <p key={i} className="text-sm text-slate-700">
                Report: “{r.reason}”
              </p>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => decideCase(c.id, 'DISMISS')}>
                Dismiss
              </Button>
              <Button variant="danger" onClick={() => decideCase(c.id, 'CONFIRM_VIOLATION')}>
                Confirm violation
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Pending appeals ({appeals.data?.appeals.length ?? 0})
        </h2>
        {appeals.error && <Alert>{appeals.error}</Alert>}
        {appeals.data?.appeals.length === 0 && (
          <p className="text-sm text-slate-500">No appeals.</p>
        )}
        {appeals.data?.appeals.map((a) => (
          <Card key={a.id} className="space-y-2">
            <p className="font-semibold">
              {a.userName} <span className="font-normal text-slate-500">({a.userEmail})</span>
            </p>
            <p className="text-sm">“{a.reason}”</p>
            <p className="text-xs text-slate-500">
              {a.violationCount} violations · {formatDateTime(a.createdAt)}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => decideAppeal(a.id, 'APPROVE')}>Approve</Button>
              <Button variant="secondary" onClick={() => decideAppeal(a.id, 'REJECT')}>
                Reject
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return <RequireAuth admin>{() => <Admin />}</RequireAuth>;
}
