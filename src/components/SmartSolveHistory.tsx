'use client';

import { useMemo, useState } from 'react';
import { useSmartSolves } from '@/hooks/useSmartSolves';
import { useT } from '@/hooks/useT';
import { readSolve, turnsPerSecond, type SmartSolveRecord } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import { clearSmartSolves, deleteSmartSolve } from '@/lib/smart-solve-store';
import { InfoTip } from './InfoTip';
import { buttonClass, CARD, CloseIcon, iconButtonClass, LINK, Note } from './ui';

const SHOWN = 10;

// Past smart cube solves of one case, newest first. Renders nothing until
// there is at least one, so pages look the same for everyone else.
export function SmartSolveHistory({ practice, caseId }: { practice: TrainerPractice; caseId: string }) {
  const { t, intl } = useT();
  const records = useSmartSolves(practice, caseId);
  const [showAll, setShowAll] = useState(false);
  if (!records || records.length === 0) return null;
  const shown = showAll ? records : records.slice(0, SHOWN);
  const date = new Intl.DateTimeFormat(intl, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <section data-ui="SmartSolveHistory" className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1 text-lg font-medium">
          {t('smartCube.history.title')}
          <InfoTip>{t('smartCube.history.help')}</InfoTip>
        </h2>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('smartCube.history.confirmClearCase'))) void clearSmartSolves({ practice, caseId });
          }}
          className={buttonClass('danger', 'sm')}
        >
          {t('smartCube.history.clearCase')}
        </button>
      </header>
      <ul className="space-y-2">
        {shown.map((record) => <HistoryRow key={record.id} record={record} date={date} />)}
      </ul>
      {!showAll && records.length > SHOWN && (
        <button type="button" onClick={() => setShowAll(true)} className={`${LINK} text-sm`}>
          {t('smartCube.history.showAll', { count: records.length })}
        </button>
      )}
    </section>
  );
}

// One past solve. Its moves are read again from its turns, so records made
// before slices were read show them as slices too.
function HistoryRow({ record, date }: { record: SmartSolveRecord; date: Intl.DateTimeFormat }) {
  const { t } = useT();
  const moves = useMemo(() => {
    const read = readSolve(record).moves;
    return { notation: read.map((m) => m.move).join(' '), count: read.length, tps: turnsPerSecond(read.length, record.executionMs) };
  }, [record]);
  return (
    <li data-ui="HistoryRow" className={`${CARD} p-3 text-sm`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono font-semibold tabular-nums">{(record.executionMs / 1000).toFixed(3)}</span>
        {record.mode === 'no-scramble' && (
          <Note>{t('smartCube.history.noScramble')}</Note>
        )}
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {t('smartCube.solve.summary', { moves: moves.count, tps: moves.tps.toFixed(2) })}
        </span>
        {record.recognitionMs !== null && (
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {t('smartCube.trainer.recognition', { seconds: (record.recognitionMs / 1000).toFixed(2) })}
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{date.format(new Date(record.recordedAt))}</span>
        <button
          type="button"
          onClick={() => void deleteSmartSolve(record.id)}
          aria-label={t('smartCube.history.delete')}
          title={t('smartCube.history.delete')}
          className={`${iconButtonClass('ghost', false, 'sm')} -my-1.5`}
        >
          <CloseIcon />
        </button>
      </div>
      <p className="mt-1 font-mono text-xs break-words text-zinc-700 dark:text-zinc-300">{moves.notation}</p>
    </li>
  );
}
