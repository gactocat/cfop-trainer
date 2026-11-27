'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '@/hooks/useMounted';
import { useT } from '@/hooks/useT';
import { HEADER_ACTIONS_ID } from '@/lib/header-slots';
import type { SolvesSnapshot } from '@/lib/solve-store';
import type { SolveEvent } from '@/lib/solve/solve-record';
import { FullScreenModal } from './FullScreenModal';
import { SolveRecords } from './SolveRecords';

function RecordsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// A solve page's records (its kind's), out of the way of the solve: an icon
// in the app header (as the list pages keep their controls there) opens
// them over the page, with the best, ao5, ao12 and every solve (SolveRecords).
export function SolveRecordsButton({ event, snapshot, onDelete }: { event: SolveEvent; snapshot: SolvesSnapshot; onDelete: (id: string) => void }) {
  const { t } = useT();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  // The header's slot exists once the page is in the browser.
  const actions = mounted ? document.getElementById(HEADER_ACTIONS_ID) : null;
  return (
    <>
      {actions && createPortal(
        <div className="ml-auto flex shrink-0 items-center">
          <button type="button" onClick={() => setOpen(true)} aria-label={t('solve.records.title')} title={t('solve.records.title')} aria-haspopup="dialog"
            className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <RecordsIcon />
          </button>
        </div>,
        actions,
      )}
      <FullScreenModal open={open} onClose={() => setOpen(false)} title={t('solve.records.title')} overlay>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SolveRecords event={event} snapshot={snapshot} onDelete={onDelete} className="mx-auto w-full max-w-2xl" />
        </div>
      </FullScreenModal>
    </>
  );
}
