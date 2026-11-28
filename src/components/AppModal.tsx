'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/hooks/useT';
import { InfoTip } from './InfoTip';
import { CloseIcon, iconButtonClass } from './ui';

/**
 * A dialog's or full-screen panel's title bar: the title, its (i) when
 * there is more to say about it, and close. `hidden` keeps its place while
 * it steps aside (the timer running).
 */
export function TitleBar({ title, titleId, info, onClose, hidden = false }: {
  title: string;
  titleId?: string;
  info?: ReactNode;
  onClose: () => void;
  hidden?: boolean;
}) {
  const { t } = useT();
  return (
    <div data-ui="TitleBar" className={`flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white pl-4 pr-2.5 dark:border-zinc-800 dark:bg-zinc-900 ${hidden ? 'invisible' : ''}`}>
      <h2 id={titleId} className="flex min-w-0 items-center gap-1 text-base font-semibold">
        <span className="truncate">{title}</span>
        {info && <InfoTip>{info}</InfoTip>}
      </h2>
      <button type="button" onClick={onClose} data-readonly-allowed aria-label={t('common.close')} title={t('common.close')} className={iconButtonClass()}>
        <CloseIcon />
      </button>
    </div>
  );
}

// A dialog for something changed in place and closed (a practice's or a
// solve's settings, the smart cube, the account). It holds the page's
// timers and keys back while open (data-app-overlay). It hangs from the top,
// so rows that come and go (a cube connecting) move only what is below them.
export function AppModal({ title, info, onClose, children }: { title: string; info?: ReactNode; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <dialog data-ui="AppModal" ref={dialog} aria-modal="true" aria-labelledby={titleId} data-app-overlay
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="mx-auto mb-auto mt-[max(1rem,env(safe-area-inset-top),8dvh)] max-h-[calc(92dvh-1rem-env(safe-area-inset-bottom))] w-[calc(100%-2rem-env(safe-area-inset-left)-env(safe-area-inset-right))] max-w-md overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50 p-0 text-zinc-900 shadow-xl backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <TitleBar title={title} titleId={titleId} info={info} onClose={onClose} />
      <div className="p-4">{children}</div>
    </dialog>, document.body,
  );
}
