'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import type { ChatMessage } from '@/lib/types';

/** How often an open thread asks the API for new messages. */
const POLL_MS = 5000;

/**
 * One trade's chat thread, backed by /transactions/:id/messages. Loads the history, then
 * polls with ?after= for new messages while mounted. Sending appends the saved message.
 * Mount it once per thread (key the component by transaction id) so state starts fresh.
 */
export function useChatThread(transactionId: string, onActivity?: () => void) {
  const { call } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const latest = useRef<string | undefined>(undefined);
  const activity = useRef(onActivity);
  useEffect(() => {
    activity.current = onActivity;
  });

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      latest.current = next.at(-1)?.createdAt;
      return next;
    });
    activity.current?.();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const after = latest.current ? `?after=${encodeURIComponent(latest.current)}` : '';
      try {
        const res = await call<{ messages: ChatMessage[] }>(
          `/transactions/${transactionId}/messages${after}`,
        );
        if (cancelled) return;
        merge(res.messages);
        setLoaded(true);
        setError(undefined);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }

    poll();
    const timer = setInterval(() => {
      // Skip polling while the tab is hidden; catch up when it is visible again.
      if (document.visibilityState === 'visible') poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [transactionId, call, merge]);

  const send = useCallback(
    async (text: string) => {
      const res = await call<{ message: ChatMessage }>(`/transactions/${transactionId}/messages`, {
        body: { text },
      });
      merge([res.message]);
    },
    [call, transactionId, merge],
  );

  return { messages, loaded, error, send };
}

/** "12.00" — Indonesian clock format used in the Figma chat. */
export const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
