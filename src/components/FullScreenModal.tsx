'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/hooks/useT';

interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// A full-viewport modal portaled to <body> so the sticky header's
// backdrop-blur (a containing block for fixed elements) doesn't trap it.
export function FullScreenModal({ open, onClose, title, children }: FullScreenModalProps) {
  const { t } = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-50 dark:bg-zinc-950"
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4">{children}</div>
    </div>,
    document.body,
  );
}
