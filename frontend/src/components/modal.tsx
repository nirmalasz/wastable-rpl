'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './ui';
import { CloseIcon } from './icons';

/**
 * Centered dialog on a dimmed backdrop (same look as the edit-profile dialog).
 * Esc, the close button and a click on the backdrop all call `onClose`.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog element itself (not its content) is a backdrop click.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-[20px] bg-white p-0 text-ink shadow-card backdrop:bg-black/40"
    >
      <div className="max-h-[85vh] space-y-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink hover:bg-cream"
          >
            <CloseIcon size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** "Are you sure?" dialog that replaces the browser's confirm() box. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-ink">{children}</div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
