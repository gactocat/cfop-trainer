'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getTimerFocus, getTimerFocusServerSnapshot, subscribeTimerFocus } from '@/lib/timer-focus';
import { StorageStatus, WritableArea } from './AccountBoundary';
import { TitleBar } from './AppModal';

interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  // Optional explanation shown behind an (i) next to the title.
  info?: ReactNode;
  /** Holds the page's timers and keys back while open (data-app-overlay), as a dialog does: for a view over a timer, not for a trainer itself. */
  overlay?: boolean;
  children: ReactNode;
}

// A full-viewport modal portaled to <body> so the sticky header's
// backdrop-blur (a containing block for fixed elements) doesn't trap it.
export function FullScreenModal({ open, onClose, title, info, overlay = false, children }: FullScreenModalProps) {
  const root = useRef<HTMLDivElement | null>(null);
  // The title bar steps aside while the timer is held or running.
  const focus = useSyncExternalStore(subscribeTimerFocus, getTimerFocus, getTimerFocusServerSnapshot);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // A dialog opened on top (the smart cube one) closes by itself.
      const above = [...document.querySelectorAll('[data-app-overlay]')].some((element) => element !== root.current);
      if (e.key === 'Escape' && !above) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-app-overlay={overlay || undefined}
      className="fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-zinc-50 dark:bg-zinc-950"
    >
      <TitleBar title={title} info={info} onClose={onClose} hidden={focus} />
      {/* Room at the bottom for the test cube's panel while it is out (see TestCubePanel). */}
      <div className="flex-1 min-h-0 flex flex-col p-3 pb-[max(0.75rem,var(--test-cube-inset,0px))] sm:p-4 sm:pb-[max(1rem,var(--test-cube-inset,0px))]">
        <StorageStatus floating />
        <WritableArea>{children}</WritableArea>
      </div>
    </div>,
    document.body,
  );
}
