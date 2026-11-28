'use client';

import { useMemo } from 'react';
import { useT } from '@/hooks/useT';
import type { PracticeResult } from '@/lib/practice-log';
import { summarizeByCase, summarizeSession } from '@/lib/session-stats';
import { formatSolveTime } from '@/lib/solve/solve-stats';
import { Figure } from './Figure';
import { CARD, LABEL } from './ui';

const seconds2 = (value: number | null) => (value === null ? '-' : value.toFixed(2));
/**
 * A time in seconds as the result and the solve records show one: a single
 * solve cut to the hundredth, as the result shows it, a mean of several
 * rounded (`over` is how many solves it is over).
 */
const time = (value: number | null, over: number) => (value === null ? '-' : formatSolveTime(value * 1000, { average: over > 1 }));
const moves1 = (value: number | null) => (value === null ? '-' : value.toFixed(1));

// This session as a whole (mean time, moves and TPS), then case by case:
// recognition and solving (mean, with the best below), moves and TPS, always
// in sight (the session's page, the end of a round). `heading` is left out
// where the page's title says it.
export function SessionStats({ results, note, heading = true, className = '' }: {
  results: readonly PracticeResult[];
  note?: string;
  heading?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const totals = useMemo(() => summarizeSession(results), [results]);
  const rows = useMemo(() => summarizeByCase(results), [results]);
  const withRecognition = rows.some((row) => row.recognition !== null);
  const th = 'px-1 py-1 font-normal';
  const best = (value: number) => (
    <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">{t('trainer.session.best', { value: formatSolveTime(value * 1000) })}</span>
  );
  return (
    <section data-ui="SessionStats" className={`w-full ${CARD} p-4 text-sm ${className}`}>
      <h3 className={`flex items-baseline gap-2 ${LABEL} ${heading ? 'justify-between' : 'justify-end'}`}>
        {heading && t('trainer.noScramble.session')}
        {totals.count > 0 && <span className="normal-case tracking-normal">{t('trainer.session.count', { count: totals.count })}</span>}
      </h3>
      {totals.count === 0 ? (
        <p className={`${heading ? 'mt-3' : ''} text-xs text-zinc-500 dark:text-zinc-400`}>{t('trainer.noScramble.empty')}</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            <Figure label={t('trainer.session.meanTime')} value={time(totals.meanSeconds, totals.count)} />
            <Figure label={t('trainer.session.meanMoves')} value={moves1(totals.meanMoves)} />
            <Figure label={t('trainer.session.meanTps')} value={seconds2(totals.meanTps)} />
          </dl>
          <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <h4 className={LABEL}>{t('trainer.session.details')}</h4>
            <table className="mt-2 w-full table-fixed text-right">
              <thead className="text-[10px] text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className={`${th} w-[32%] text-left`}>{t('trainer.session.case')}</th>
                  {withRecognition && <th className={`${th} text-sky-700 dark:text-sky-300`}>{t('trainer.cube.recognition')}</th>}
                  <th className={th}>{t('trainer.cube.solve')}</th>
                  <th className={th}>{t('trainer.session.moves')}</th>
                  <th className={th}>TPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono text-xs tabular-nums dark:divide-zinc-800">
                {rows.map((row) => (
                  <tr key={row.caseId} className="align-top">
                    <td className="px-1 py-1 text-left font-sans">
                      <span className="block truncate text-zinc-700 dark:text-zinc-200">{row.name}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{t('trainer.session.count', { count: row.count })}</span>
                    </td>
                    {withRecognition && (
                      <td className="px-1 py-1 text-sky-700 dark:text-sky-300">
                        {row.recognition ? <>{time(row.recognition.mean, row.recognition.count)}{row.recognition.count > 1 && best(row.recognition.best)}</> : '-'}
                      </td>
                    )}
                    <td className="px-1 py-1">{time(row.solve.mean, row.solve.count)}{row.solve.count > 1 && best(row.solve.best)}</td>
                    <td className="px-1 py-1">{moves1(row.moves)}</td>
                    <td className="px-1 py-1">{seconds2(row.tps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {note && <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">{note}</p>}
    </section>
  );
}
