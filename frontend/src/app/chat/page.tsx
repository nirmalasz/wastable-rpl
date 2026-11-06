'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { RequireAuth } from '@/components/require-auth';
import { Alert, Badge, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { chatTime, useChatThreads, type ChatMessage } from '@/features/chat';
import { humanize } from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/* eslint-disable @next/next/no-img-element -- static icon SVGs exported from Figma */

const QUICK_REPLIES = [
  'Hi! Is this still available?',
  'When can I pick it up?',
  'Where exactly is the pickup point?',
  'Thanks, see you soon!',
];

/** One conversation row: avatar, bold-italic name, preview, time on the right. */
function ThreadRow({
  trx,
  last,
  active,
  onSelect,
}: {
  trx: Transaction;
  last?: ChatMessage;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="border-b-2 border-[#d9d9d9] last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={`flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-cream ${
          active ? 'bg-cream' : ''
        }`}
      >
        <Avatar name={trx.counterpart.name} size={68} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[28px] leading-tight font-bold italic text-ink">
            {trx.counterpart.name}
          </span>
          <span className="block truncate text-xl font-medium text-ink">
            {last ? last.text : trx.listingTitle}
          </span>
        </span>
        <span className="self-start text-xl font-medium tracking-[-1px] text-[#9c9c9c]">
          {chatTime(last?.sentAt ?? trx.createdAt)}
        </span>
      </button>
    </li>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  return (
    <div className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[80%] rounded-[10px] px-5 py-4 text-xl font-medium break-words shadow-[0_1.2px_1.2px_0_rgb(0_0_0/0.25)] sm:text-[25px] ${
          m.mine
            ? 'rounded-tr-none bg-brand-500 text-white'
            : 'rounded-tl-none bg-cream text-brand-700'
        }`}
      >
        {m.text}
      </p>
      <span className="mt-1 px-1 text-sm font-medium text-ink/80">{chatTime(m.sentAt)}</span>
    </div>
  );
}

function Thread({
  trx,
  messages,
  onSend,
  onBack,
}: {
  trx: Transaction;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, trx.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[17px] bg-brand-50 shadow-card">
      <header className="relative flex items-center gap-3 rounded-t-[17px] bg-white px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="text-2xl text-ink lg:hidden"
          aria-label="Back to conversations"
        >
          ←
        </button>
        <Avatar name={trx.counterpart.name} size={68} />
        <h2 className="min-w-0 flex-1 truncate font-sans text-[28px] font-bold italic text-ink">
          {trx.counterpart.name}
        </h2>
        <button
          type="button"
          onClick={() => setShowInfo((s) => !s)}
          aria-expanded={showInfo}
          aria-label="Trade details"
          className="flex gap-1.5 rounded-full p-2 hover:bg-cream"
        >
          <img src="/icons/dot.svg" alt="" width={13} height={13} />
          <img src="/icons/dot.svg" alt="" width={13} height={13} />
          <img src="/icons/dot.svg" alt="" width={13} height={13} />
        </button>
        {showInfo && (
          <div className="absolute top-full right-4 z-10 mt-2 w-72 space-y-1 rounded-[14px] bg-white p-4 text-sm shadow-card">
            <Link
              href={`/listings/${trx.listingId}`}
              className="font-semibold text-brand-700 underline"
            >
              {trx.listingTitle}
            </Link>
            <p>
              <Badge tone={trx.status === 'COMPLETED' ? 'brand' : 'neutral'}>
                {humanize(trx.status)}
              </Badge>{' '}
              · you are the {trx.role === 'BUYER' ? 'buyer' : 'seller'}
            </p>
            <p className="text-muted">Pickup: {trx.pickupArea}</p>
            {trx.counterpart.contact && (
              <p className="text-muted">Contact: {trx.counterpart.contact}</p>
            )}
            <Link href="/dashboard" className="block pt-1 text-brand-700 underline">
              Manage in dashboard
            </Link>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <p className="mx-auto max-w-sm rounded-[10px] bg-white/70 px-4 py-3 text-center text-sm text-ink">
            Say hi to arrange pickup for <strong>{trx.listingTitle}</strong>.
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        <div ref={bottom} />
      </div>

      <div className="relative px-6 pb-6">
        {showQuick && (
          <ul className="absolute bottom-full left-6 mb-2 space-y-1 rounded-[14px] bg-white p-2 shadow-card">
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
          onSubmit={submit}
          className="flex h-[58px] items-center gap-3 rounded-[17px] bg-white/80 pr-2 pl-3"
        >
          <button
            type="button"
            onClick={() => setShowQuick((s) => !s)}
            aria-label="Quick replies"
            aria-expanded={showQuick}
            className="w-8 text-[45px] leading-none font-medium text-ink"
          >
            +
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Chat Input"
            aria-label="Message"
            maxLength={1000}
            className="min-w-0 flex-1 bg-transparent text-xl font-medium text-ink placeholder:text-ink focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim()}
            className="relative flex size-[43px] shrink-0 items-center justify-center transition hover:brightness-95 disabled:opacity-60"
          >
            <img
              src="/icons/send-bg.svg"
              alt=""
              width={43}
              height={43}
              className="absolute inset-0"
            />
            <img
              src="/icons/send.svg"
              alt=""
              width={17}
              height={26}
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
  const { threads, send } = useChatThreads();
  const [query, setQuery] = useState('');
  const activeId = params.get('with');

  if (trx.error) return <Alert>{trx.error}</Alert>;
  if (!trx.data) return <Loading />;

  const all = trx.data.transactions;
  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter(
        (t) =>
          t.counterpart.name.toLowerCase().includes(q) || t.listingTitle.toLowerCase().includes(q),
      )
    : all;
  const active = all.find((t) => t.id === activeId);
  const select = (id: string | null) => router.replace(id ? `/chat?with=${id}` : '/chat');

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Chat</h1>
      <p className="text-xs text-muted">
        Messages are saved on this device only for now. Use the contact under ••• to reach your
        trade partner directly.
      </p>
      <div className="grid h-[calc(100vh-11rem)] min-h-[520px] gap-3 lg:grid-cols-[535fr_754fr]">
        <aside
          className={`min-h-0 flex-col overflow-hidden rounded-[17px] bg-white shadow-card ${
            active ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <label className="mx-3 mt-4 mb-2 flex h-14 items-center gap-2 rounded-[30px] bg-[#e8e8e8] px-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search conversations"
              className="min-w-0 flex-1 bg-transparent text-2xl font-bold italic text-ink placeholder:text-[#9c9c9c] focus:outline-none"
            />
            <img src="/icons/search-grey.svg" alt="" width={26} height={26} />
          </label>
          {shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              {all.length === 0
                ? 'No conversations yet. Claim a listing to start chatting with the seller.'
                : 'No conversations match your search.'}
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {shown.map((t) => (
                <ThreadRow
                  key={t.id}
                  trx={t}
                  last={threads[t.id]?.at(-1)}
                  active={t.id === active?.id}
                  onSelect={() => select(t.id)}
                />
              ))}
            </ul>
          )}
        </aside>

        {active ? (
          <Thread
            trx={active}
            messages={threads[active.id] ?? []}
            onSend={(text) => send(active.id, text)}
            onBack={() => select(null)}
          />
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
        <Suspense fallback={<Loading />}>
          <Chat />
        </Suspense>
      )}
    </RequireAuth>
  );
}
