'use client';

import { useState } from 'react';
import { useSmartSolves } from '@/hooks/useSmartSolves';
import { useT } from '@/hooks/useT';
import type { SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { mergeTurns, solveNotation, turnsPerSecond } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import { clearSmartSolves, deleteSmartSolve } from '@/lib/smart-solve-store';
import { InfoTip } from './InfoTip';

const SHOWN = 10;

// The turns of the solve just stopped, for the trainer's result screen.
export function SmartSolveSummary({ solve }: { solve: SmartSolve }) {
  const { t } = useT();
  const count = mergeTurns(solve.turns).length;
  return (
    <div className="space-y-1 text-center">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {t('smartCube.solve.turned')}
        {' · '}
        {t('smartCube.solve.summary', { moves: count, tps: turnsPerSecond(count, solve.executionMs).toFixed(2) })}
      </div>
      <p className="font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">{solveNotation(solve.turns, solve.holding)}</p>
    </div>
  );
}

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
    <section className="space-y-3">
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
          className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {t('smartCube.history.clearCase')}
        </button>
      </header>
      <ul className="space-y-2">
        {shown.map((record) => (
          <li key={record.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono font-semibold tabular-nums">{(record.executionMs / 1000).toFixed(3)}</span>
              {record.mode === 'no-scramble' && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {t('smartCube.history.noScramble')}
                </span>
              )}
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {t('smartCube.solve.summary', { moves: record.moveCount, tps: record.tps.toFixed(2) })}
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
                className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 font-mono text-xs break-words text-zinc-700 dark:text-zinc-300">{solveNotation(record.turns, record.holding)}</p>
          </li>
        ))}
      </ul>
      {!showAll && records.length > SHOWN && (
        <button type="button" onClick={() => setShowAll(true)} className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
          {t('smartCube.history.showAll', { count: records.length })}
        </button>
      )}
    </section>
  );
}
