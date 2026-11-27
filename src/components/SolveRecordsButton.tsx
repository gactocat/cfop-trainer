'use client';

import { useT } from '@/hooks/useT';
import { solveRecordsPath } from '@/lib/solve/solve-pages';
import type { SolveMode } from '@/lib/solve/solve-modes';
import { HeaderPageLink } from './HeaderPageLink';
import { Icon } from './ui';

export function RecordsIcon() {
  return <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></Icon>;
}

// A solve page's records (its kind's), behind an icon in the app header:
// a page of their own (SolveRecordsPage), the solve kept as it was behind it.
export function SolveRecordsButton({ mode }: { mode: SolveMode }) {
  const { t } = useT();
  return <HeaderPageLink label={t('solve.records.title')} icon={<RecordsIcon />} href={solveRecordsPath(mode)} />;
}
