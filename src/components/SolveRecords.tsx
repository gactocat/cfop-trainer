'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/hooks/useT';
import type { SolvesSnapshot } from '@/lib/solve-store';
import { solveTps } from '@/lib/solve/cfop-split';
import type { SolveRecord } from '@/lib/solve/solve-record';
import { formatSolveTime, solveStats } from '@/lib/solve/solve-stats';
import { SolveStages } from './SolveStages';

const PAGE = 50;
const CARD = 'rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900';
const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className={LABEL}>{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

/** How the solve was timed: by the smart cube, or with the on-screen timer. */
export function TimerBadge({ record }: { record: SolveRecord }) {
  const { t } = useT();
  return record.timer === 'cube' ? (
    <span className="rounded-full border border-emerald-300 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:text-emerald-200">
      {t('solve.timer.cube')}
    </span>
  ) : (
    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      {t('solve.timer.hand')}
    </span>
  );
}

/** Moves and TPS of a cube solve, e.g. "54 moves · 4.38 TPS"; null for a hand-timed one. */
export function useMovesSummary(record: SolveRecord): string | null {
  const { t } = useT();
  if (record.moveCount === undefined) return null;
  const tps = solveTps(record.moveCount, record.ms);
  return t('smartCube.solve.summary', { moves: record.moveCount, tps: tps === null ? '-' : tps.toFixed(2) });
}

function SolveRow({ number, record, onDelete }: { number: number; record: SolveRecord; onDelete: () => void }) {
  const { t, intl } = useT();
  const summary = useMovesSummary(record);
  const when = new Intl.DateTimeFormat(intl, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(record.recordedAt));
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
          <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">{number}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{formatSolveTime(record.ms)}</span>
            {summary && <span className="block font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{summary}</span>}
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <TimerBadge record={record} />
            <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{when}</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90 dark:text-zinc-500">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </summary>
        <div className="space-y-3 pb-3 pl-11">
          <div>
            <div className={LABEL}>{t('solve.scramble')}</div>
            <p className="mt-0.5 font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">{record.scramble}</p>
          </div>
          <SolveStages record={record} />
          <button
            type="button"
            onClick={() => { if (window.confirm(t('solve.history.confirmDelete'))) onDelete(); }}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {t('common.delete')}
          </button>
        </div>
      </details>
    </li>
  );
}

// This device's solves: best single, the latest ao5 and ao12 (with the best
// of each), and every solve, newest first, opening to its scramble, stages
// and a delete button.
export function SolveRecords({ snapshot, onDelete, className = '' }: {
  snapshot: SolvesSnapshot;
  onDelete: (id: string) => void;
  className?: string;
}) {
  const { t, tn } = useT();
  const { solves, status } = snapshot;
  const stats = useMemo(() => solveStats(solves.map((s) => s.ms)), [solves]);
  const [shown, setShown] = useState(PAGE);
  const average = (ms: number | null) => formatSolveTime(ms, { average: true });
  return (
    <section aria-labelledby="solve-records" className={`${CARD} ${className}`}>
      <h2 id="solve-records" className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>{t('solve.records.title')}</span>
        {stats.count > 0 && <span className="text-xs text-zinc-500 dark:text-zinc-400">{tn('common.solves', stats.count)}</span>}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Figure label={t('common.best')} value={formatSolveTime(stats.best)} />
        <Figure label="ao5" value={average(stats.ao5)} />
        <Figure label="ao12" value={average(stats.ao12)} />
      </dl>
      {(stats.bestAo5 !== null || stats.bestAo12 !== null) && (
        <p className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          {t('solve.records.bestAverages', { ao5: average(stats.bestAo5), ao12: average(stats.bestAo12) })}
        </p>
      )}
      {status === 'loading' ? (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{t('common.loading')}</p>
      ) : solves.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{t('solve.records.empty')}</p>
      ) : (
        <ol className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {solves.slice(0, shown).map((record, i) => (
            <SolveRow key={record.id} number={solves.length - i} record={record} onDelete={() => onDelete(record.id)} />
          ))}
        </ol>
      )}
      {solves.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-2 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {t('solve.records.more', { count: Math.min(PAGE, solves.length - shown) })}
        </button>
      )}
      <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
        {t(status === 'unavailable' ? 'solve.records.unavailable' : 'solve.records.device')}
      </p>
    </section>
  );
}
