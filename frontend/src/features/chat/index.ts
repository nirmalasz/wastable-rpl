'use client';

import { useCallback } from 'react';
import { createLocalStore } from '@/lib/local-store';

/**
 * Trade chat, one thread per transaction. The API has no messaging endpoint yet, so
 * threads are kept in this browser only; swap `store` for API calls once one exists.
 */
export interface ChatMessage {
  id: string;
  text: string;
  sentAt: string;
  mine: boolean;
}

const store = createLocalStore<Record<string, ChatMessage[]>>('wastable.chat', {});

export function useChatThreads() {
  const threads = store.useValue();

  const send = useCallback((threadId: string, text: string) => {
    const all = store.get();
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      sentAt: new Date().toISOString(),
      mine: true,
    };
    store.set({ ...all, [threadId]: [...(all[threadId] ?? []), message] });
  }, []);

  return { threads, send };
}

/** "12.00" — Indonesian clock format used in the Figma chat. */
export const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
