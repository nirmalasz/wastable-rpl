'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, LoadingBlock } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { chatTime, useChatThread } from '@/features/chat';
import { ReviewForm } from '@/features/reviews';
import { humanize } from '@/lib/format';
import type { ChatMessage, Inquiry, Transaction } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/* eslint-disable @next/next/no-img-element -- static icon SVGs exported from Figma */

const QUICK_REPLIES = [
  'Hi! Is this still available?',
  'When can I pick it up?',
  'Where exactly is the pickup point?',
  'Thanks, see you soon!',
];

/**
 * One conversation, whichever kind: a trade (after a claim) or a question asked before
 * claiming. Trades open with ?with=<transactionId>, questions with ?ask=<inquiryId>.
 */
interface ChatThread {
  kind: 'trade' | 'inquiry';
  id: string;
  /** Query string that opens this thread. */
  param: string;
  messagesPath: string;
  role: 'BUYER' | 'SELLER';
  counterpart: { id: string; name: string; avatarUrl: string | null };
  listingId: string;
  listingTitle: string;
  unreadCount: number;
  lastMessage: Transaction['lastMessage'];
  createdAt: string;
  /** Why no new messages can be sent, or null. */
  closedReason: string | null;
  trade?: Transaction;
}

const fromTrade = (t: Transaction): ChatThread => ({
  kind: 'trade',
  id: t.id,
  param: `with=${t.id}`,
  messagesPath: `/transactions/${t.id}/messages`,
  role: t.role,
  counterpart: t.counterpart,
  listingId: t.listingId,
  listingTitle: t.listingTitle,
  unreadCount: t.unreadCount,
  lastMessage: t.lastMessage,
  createdAt: t.createdAt,
  closedReason:
    t.status === 'CANCELLED' ? 'This trade was cancelled, so the chat is closed.' : null,
  trade: t,
});

const fromInquiry = (q: Inquiry): ChatThread => ({
  kind: 'inquiry',
  id: q.id,
  param: `ask=${q.id}`,
  messagesPath: `/inquiries/${q.id}/messages`,
  role: q.role,
  counterpart: q.counterpart,
  listingId: q.listingId,
  listingTitle: q.listingTitle,
  unreadCount: q.unreadCount,
  lastMessage: q.lastMessage,
  createdAt: q.createdAt,
  closedReason:
    q.listingStatus === 'REMOVED' || q.listingStatus === 'UNDER_REVIEW'
      ? 'This listing is no longer shown, so the chat is closed.'
      : null,
});

const lastActivity = (t: ChatThread) => new Date(t.lastMessage?.createdAt ?? t.createdAt).getTime();

/** One conversation row: avatar, bold-italic name, preview, time on the right. */
function ThreadRow({
  thread: trx,
  active,
  onSelect,
}: {
  thread: ChatThread;
  active: boolean;
  onSelect: () => void;
}) {
  const last = trx.lastMessage;
  // The open thread is being read right now, so do not show it as unread.
  const unread = active ? 0 : trx.unreadCount;
  return (
    <li className="border-b border-[#d9d9d9] last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream ${
          active ? 'bg-cream' : ''
        }`}
      >
        <Avatar url={trx.counterpart.avatarUrl} name={trx.counterpart.name} size={48} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-bold italic text-ink">
              {trx.counterpart.name}
            </span>
            {trx.kind === 'inquiry' && <Badge>Question</Badge>}
          </span>
          <span className="block truncate text-sm text-ink">
            {last ? `${last.mine ? 'You: ' : ''}${last.body}` : trx.listingTitle}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 self-start">
          <span
            className={`text-xs font-medium ${unread > 0 ? 'text-brand-700' : 'text-[#9c9c9c]'}`}
          >
            {chatTime(last?.createdAt ?? trx.createdAt)}
          </span>
          {unread > 0 && (
            <span
              className="min-w-6 rounded-full bg-brand-700 px-1.5 text-center text-xs leading-6 font-medium text-white"
              aria-label={`${unread} unread`}
            >
              {unread}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  return (
    <div className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[75%] rounded-[10px] px-4 py-2 text-base font-medium break-words shadow-[0_1.2px_1.2px_0_rgb(0_0_0/0.25)] ${
          m.mine
            ? 'rounded-tr-none bg-brand-500 text-white'
            : 'rounded-tl-none bg-cream text-brand-700'
        }`}
      >
        {m.body}
      </p>
      <span className="mt-1 px-1 text-xs font-medium text-ink/80">
        {chatTime(m.createdAt)}
        {m.mine && m.readAt && ' · Read'}
      </span>
    </div>
  );
}

function Thread({
  thread,
  onBack,
  onReviewed,
  onActivity,
}: {
  thread: ChatThread;
  onBack: () => void;
  onReviewed: () => void;
  /** Called when messages arrive or are sent, so the list can refresh its previews. */
  onActivity: () => void;
}) {
  const trx = thread;
  const trade = thread.trade;
  const { messages, loaded, error, send } = useChatThread(thread.messagesPath, onActivity);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, thread.param]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(undefined);
    try {
      await send(body);
      setText('');
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  }
  const closed = Boolean(thread.closedReason);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[17px] bg-brand-50 shadow-card">
      <header className="relative flex items-center gap-3 rounded-t-[17px] bg-white px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xl text-ink lg:hidden"
          aria-label="Back to conversations"
        >
          ←
        </button>
        <Link
          href={`/users/${trx.counterpart.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
          title={`See ${trx.counterpart.name}'s listings and ratings`}
        >
          <Avatar url={trx.counterpart.avatarUrl} name={trx.counterpart.name} size={40} />
          <span className="min-w-0">
            <h2 className="truncate font-sans text-base font-bold italic text-ink">
              {trx.counterpart.name}
            </h2>
            <span className="block truncate text-xs text-muted">
              {thread.kind === 'inquiry'
                ? `${trx.role === 'BUYER' ? 'Seller' : 'Asking'} · about ${trx.listingTitle}`
                : `${trx.role === 'BUYER' ? 'Seller' : 'Buyer'} · view profile`}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setShowInfo((s) => !s)}
          aria-expanded={showInfo}
          aria-label={thread.kind === 'trade' ? 'Trade details' : 'Listing details'}
          className="flex gap-1 rounded-full p-2 hover:bg-cream"
        >
          <img src="/icons/dot.svg" alt="" width={8} height={8} />
          <img src="/icons/dot.svg" alt="" width={8} height={8} />
          <img src="/icons/dot.svg" alt="" width={8} height={8} />
        </button>
        {showInfo && (
          <div className="absolute top-full right-4 z-10 mt-2 w-72 space-y-1 rounded-[14px] bg-white p-4 text-sm shadow-card">
            <Link
              href={`/listings/${trx.listingId}`}
              className="font-semibold text-brand-700 underline"
            >
              {trx.listingTitle}
            </Link>
            {trade ? (
              <>
                <p>
                  <Badge tone={trade.status === 'COMPLETED' ? 'brand' : 'neutral'}>
                    {humanize(trade.status)}
                  </Badge>{' '}
                  · you are the {trade.role === 'BUYER' ? 'buyer' : 'seller'}
                </p>
                <p className="text-muted">Pickup: {trade.pickupArea}</p>
                {trade.counterpart.contact && (
                  <p className="text-muted">Contact: {trade.counterpart.contact}</p>
                )}
              </>
            ) : (
              <p className="text-muted">
                {trx.role === 'BUYER'
                  ? 'Not claimed yet. Claim it from the listing page when you are ready.'
                  : 'A question before claiming. Contact details are shared once they claim.'}
              </p>
            )}
            <Link
              href={`/users/${trx.counterpart.id}`}
              className="block pt-1 text-brand-700 underline"
            >
              {trx.counterpart.name}&apos;s listings and ratings
            </Link>
            {trade && (
              <Link href="/dashboard" className="block text-brand-700 underline">
                Manage in dashboard
              </Link>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!loaded && !error && <LoadingBlock label="Loading messages…" />}
        {error && <p className="text-center text-sm text-danger">{error}</p>}
        {loaded && messages.length === 0 && (
          <p className="mx-auto max-w-sm rounded-[10px] bg-white/70 px-4 py-3 text-center text-sm text-ink">
            {thread.kind === 'inquiry' ? (
              <>
                Ask the seller anything about <strong>{trx.listingTitle}</strong> before you claim
                it.
              </>
            ) : (
              <>
                Say hi to arrange pickup for <strong>{trx.listingTitle}</strong>.
              </>
            )}
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottom} />
      </div>

      {trade?.status === 'COMPLETED' && (
        <div className="px-4 pb-2">
          {trade.reviewedByMe ? (
            <p className="text-center text-xs text-brand-700">
              Trade completed · you reviewed this {trade.role === 'BUYER' ? 'seller' : 'buyer'}.
            </p>
          ) : (
            <ReviewForm
              transactionId={trade.id}
              role={trade.role}
              counterpartName={trade.counterpart.name}
              onDone={onReviewed}
            />
          )}
        </div>
      )}

      <div className="relative px-4 pb-4">
        {closed && (
          <p className="rounded-[16px] bg-white/80 px-4 py-3 text-center text-sm text-muted">
            {thread.closedReason}
          </p>
        )}
        {sendError && <p className="mb-2 text-center text-xs text-danger">{sendError}</p>}
        {!closed && showQuick && (
          <ul className="absolute bottom-full left-4 mb-2 space-y-1 rounded-[14px] bg-white p-2 shadow-card">
            {QUICK_REPLIES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => {
                    setText(q);
                    setShowQuick(false);
                  }}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-brand-50"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          hidden={closed}
          onSubmit={submit}
          className="flex h-12 items-center gap-2 rounded-[16px] bg-white/80 pr-1 pl-3"
        >
          <button
            type="button"
            onClick={() => setShowQuick((s) => !s)}
            aria-label="Quick replies"
            aria-expanded={showQuick}
            className="w-6 text-2xl leading-none font-medium text-ink"
          >
            +
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Chat Input"
            aria-label="Message"
            maxLength={1000}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink/60 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim() || sending}
            className="relative flex size-10 shrink-0 items-center justify-center transition hover:brightness-95 disabled:opacity-60"
          >
            <img
              src="/icons/send-bg.svg"
              alt=""
              width={40}
              height={40}
              className="absolute inset-0"
            />
            <img
              src="/icons/send.svg"
              alt=""
              width={13}
              height={20}
              className="relative rotate-45"
            />
          </button>
        </form>
      </div>
    </section>
  );
}

function Chat() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const trx = useApi<{ transactions: Transaction[] }>('/transactions/mine', token);
  const asks = useApi<{ inquiries: Inquiry[] }>('/inquiries/mine', token);
  const [query, setQuery] = useState('');
  const reloadTrades = trx.reload;
  const reloadAsks = asks.reload;
  const reloadList = useCallback(() => {
    reloadTrades();
    reloadAsks();
  }, [reloadTrades, reloadAsks]);

  // Refresh previews and unread badges for the other conversations.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reloadList();
    }, 15_000);
    return () => clearInterval(timer);
  }, [reloadList]);
  const activeParam = params.get('with')
    ? `with=${params.get('with')}`
    : params.get('ask')
      ? `ask=${params.get('ask')}`
      : null;

  const error = trx.error ?? asks.error;
  if (error) return <Alert>{error}</Alert>;
  if (!trx.data || !asks.data) return <LoadingBlock className="min-h-[60vh]" />;

  const all = [
    ...trx.data.transactions.map(fromTrade),
    ...asks.data.inquiries.map(fromInquiry),
  ].sort((a, b) => lastActivity(b) - lastActivity(a));
  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter(
        (t) =>
          t.counterpart.name.toLowerCase().includes(q) || t.listingTitle.toLowerCase().includes(q),
      )
    : all;
  const active = all.find((t) => t.param === activeParam);
  const select = (param: string | null) => router.replace(param ? `/chat?${param}` : '/chat');

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Chat</h1>
      <div className="grid h-[calc(100vh-11rem)] max-h-[720px] min-h-[480px] gap-4 lg:grid-cols-[320px_1fr]">
        <aside
          className={`min-h-0 flex-col overflow-hidden rounded-[17px] bg-white shadow-card ${
            active ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <label className="mx-3 mt-3 mb-2 flex h-10 items-center gap-2 rounded-[24px] bg-[#e8e8e8] px-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search conversations"
              className="min-w-0 flex-1 bg-transparent text-base font-bold italic text-ink placeholder:text-[#9c9c9c] focus:outline-none"
            />
            <img src="/icons/search-grey.svg" alt="" width={20} height={20} />
          </label>
          {shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              {all.length === 0
                ? 'No conversations yet. Open a listing and tap “Chat with seller” to ask a question.'
                : 'No conversations match your search.'}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {shown.map((t) => (
                <ThreadRow
                  key={t.param}
                  thread={t}
                  active={t.param === active?.param}
                  onSelect={() => select(t.param)}
                />
              ))}
            </ul>
          )}
        </aside>

        {active ? (
          <Thread
            thread={active}
            key={active.param}
            onBack={() => select(null)}
            onReviewed={reloadTrades}
            onActivity={reloadList}
          />
        ) : activeParam ? (
          // A link to a thread that is not in the lists (yet): e.g. just opened, still empty.
          <section className="flex items-center justify-center rounded-[17px] bg-brand-50 p-6 text-center text-ink shadow-card">
            This conversation could not be found.
          </section>
        ) : (
          <section className="hidden items-center justify-center rounded-[17px] bg-brand-50 p-6 text-center text-ink shadow-card lg:flex">
            Pick a conversation to start chatting.
          </section>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      {() => (
        <Suspense fallback={<LoadingBlock className="min-h-[60vh]" />}>
          <Chat />
        </Suspense>
      )}
    </RequireAuth>
  );
}
