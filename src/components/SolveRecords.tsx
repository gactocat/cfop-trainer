'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSolves } from '@/hooks/useSolves';
import { useT } from '@/hooks/useT';
import { declineSolveImport, importDeviceSolves, retrySolveSync, type SolvesSnapshot } from '@/lib/solve-store';
import { solveTps } from '@/lib/solve/cfop-split';
import { modeMoveCount } from '@/lib/solve/mode-record';
import type { SolveEvent, SolveRecord } from '@/lib/solve/solve-record';
import { SOLVE_MODE, type SolveMode } from '@/lib/solve/solve-modes';
import { solveRecordPath } from '@/lib/solve/solve-pages';
import { countedMs, formatRecordTime, formatSolveTime, solveStats } from '@/lib/solve/solve-stats';
import { Figure } from './Figure';
import { buttonClass, CARD, ChevronIcon, LINK } from './ui';

const PAGE = 50;

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
  const moves = useMemo(() => modeMoveCount(record), [record]);
  if (moves === undefined) return null;
  const tps = solveTps(moves, record.ms);
  return t('smartCube.solve.summary', { moves, tps: tps === null ? '-' : tps.toFixed(2) });
}

/** When a solve was recorded, short: month, day and time. */
export function useRecordedAt(record: SolveRecord, style: 'short' | 'long' = 'short'): string {
  const { intl } = useT();
  const options: Intl.DateTimeFormatOptions = style === 'short'
    ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { dateStyle: 'medium', timeStyle: 'short' };
  return new Intl.DateTimeFormat(intl, options).format(new Date(record.recordedAt));
}

// One solve in the list: its number, time (and moves and TPS with a cube),
// how it was timed and when; the whole row opens its page.
function SolveRow({ number, record, href }: { number: number; record: SolveRecord; href: string }) {
  const summary = useMovesSummary(record);
  const when = useRecordedAt(record);
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-zinc-800/60">
        <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatRecordTime(record)}
            {record.penalty === 'dnf' && <span className="ml-1.5 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">({formatSolveTime(record.ms)})</span>}
          </span>
          {summary && <span className="block font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{summary}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <TimerBadge record={record} />
          <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{when}</span>
        </span>
        <ChevronIcon className="size-4 text-zinc-400 dark:text-zinc-500" />
      </Link>
    </li>
  );
}

// Where the solves are kept (this device or the account). Saving to the
// account says nothing: it runs in the background and retries by itself.
function SyncNote({ event, snapshot }: { event: SolveEvent; snapshot: SolvesSnapshot }) {
  const { t } = useT();
  const { where, status } = snapshot;
  const note = status === 'unavailable' ? 'solve.records.unavailable'
    : where === 'account' ? 'solve.records.account'
      : where === 'device-for-account' ? 'solve.records.deviceForAccount' : 'solve.records.device';
  return (
    <div className="mt-3 space-y-1 text-[11px] text-zinc-400 dark:text-zinc-500">
      {status === 'error' ? (
        <p role="alert" className="text-amber-800 dark:text-amber-200">
          {t('solve.records.loadFailed')}{' '}
          <button type="button" onClick={() => retrySolveSync(event)} className={LINK}>{t('solve.records.reload')}</button>
        </p>
      ) : <p>{t(note)}</p>}
    </div>
  );
}

function ImportOffer({ event, count }: { event: SolveEvent; count: number }) {
  const { t } = useT();
  return (
    <div className="mt-3 rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <p className="text-zinc-700 dark:text-zinc-200">{t('solve.records.offer', { count })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void importDeviceSolves(event)} className={buttonClass('primary', 'sm')}>
          {t('solve.records.import')}
        </button>
        <button type="button" onClick={() => declineSolveImport(event)} className={buttonClass('secondary', 'sm')}>
          {t('solve.records.skipImport')}
        </button>
      </div>
    </div>
  );
}

// A kind of solve's records, a page under its solve: best single, the
// latest ao5 and ao12 (with the best of each), counting +2 and DNF as the
// WCA does, and every solve, newest first, each opening its own page
// (SolveRecordPage).
export function SolveRecords({ mode, className = '' }: { mode: SolveMode; className?: string }) {
  const event = SOLVE_MODE[mode].event;
  const snapshot = useSolves(mode);
  const { t, tn } = useT();
  const { solves, status } = snapshot;
  const stats = useMemo(() => solveStats(solves.map(countedMs)), [solves]);
  const [shown, setShown] = useState(PAGE);
  const average = (ms: number | null) => formatSolveTime(ms, { average: true });
  return (
    <section aria-labelledby="solve-records" className={`${CARD} p-4 ${className}`}>
      {/* The page's title in the header says what this is. */}
      <h2 id="solve-records" className="flex items-baseline justify-end gap-2">
        <span className="sr-only">{t('solve.records.title')}</span>
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
      {snapshot.offer > 0 && <ImportOffer event={event} count={snapshot.offer} />}
      {status === 'loading' ? (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{t('common.loading')}</p>
      ) : solves.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">{t('solve.records.empty')}</p>
      ) : (
        <ol className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {solves.slice(0, shown).map((record, i) => (
            <SolveRow key={record.id} number={solves.length - i} record={record} href={solveRecordPath(mode, record.id)} />
          ))}
        </ol>
      )}
      {solves.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className={`${LINK} mt-2 text-xs`}
        >
          {t('solve.records.more', { count: Math.min(PAGE, solves.length - shown) })}
        </button>
      )}
      <SyncNote event={event} snapshot={snapshot} />
    </section>
  );
}
