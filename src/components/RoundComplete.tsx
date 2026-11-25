'use client';

import { useT } from '@/hooks/useT';
import type { PracticeResult } from '@/lib/practice-log';
import { SessionStats } from './SessionStats';

// The end of "each selected case once": the session's figures with the
// details open, then back to the practice options (a new session, empty).
export function RoundComplete({ total, results, onBack }: {
  total: number;
  results: readonly PracticeResult[];
  onBack: () => void;
}) {
  const { t } = useT();
  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
        <h3 className="text-xl font-semibold">{t('practice.round.done', { total })}</h3>
        <SessionStats results={results} open />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('practice.round.doneHelp')}</p>
        {/* Focused, so Space or Enter goes back. */}
        <button type="button" autoFocus onClick={onBack}
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          {t('practice.round.back')}
        </button>
      </div>
    </div>
  );
}
