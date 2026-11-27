'use client';

import { useT } from '@/hooks/useT';
import type { SolvesSnapshot } from '@/lib/solve-store';
import type { SolveEvent } from '@/lib/solve/solve-record';
import { HeaderPanelButton } from './HeaderPanelButton';
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

// A solve page's records (its kind's), behind an icon in the app header:
// the best, ao5, ao12 and every solve (SolveRecords).
export function SolveRecordsButton({ event, snapshot, onDelete }: { event: SolveEvent; snapshot: SolvesSnapshot; onDelete: (id: string) => void }) {
  const { t } = useT();
  return (
    <HeaderPanelButton label={t('solve.records.title')} icon={<RecordsIcon />}>
      <SolveRecords event={event} snapshot={snapshot} onDelete={onDelete} className="mx-auto w-full max-w-2xl" />
    </HeaderPanelButton>
  );
}
