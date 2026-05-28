'use client';

import Link from 'next/link';
import {
  ALL_F2LS,
  F2L_CATEGORY_LABELS,
  F2L_CATEGORY_ORDER,
} from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useF2LRandomSolves } from '@/hooks/useF2LRandomSolves';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { F2L3DPlayer } from './F2L3DPlayer';
import type { F2LId } from '@/types/f2l';

export type F2LGridMode = 'all' | 'random';

interface F2LGridProps {
  mode: F2LGridMode;
}

function timeBadgeClasses(seconds: number | null): string {
  if (seconds === null) return 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  if (seconds < 2.5) return 'bg-emerald-500 text-white';
  if (seconds < 4) return 'bg-emerald-300 text-emerald-950';
  if (seconds < 6) return 'bg-amber-300 text-amber-950';
  return 'bg-rose-400 text-rose-950';
}

function formatLastDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function F2LGrid({ mode }: F2LGridProps) {
  const { ready: algReady, starredFor, all: allAlgorithms } = useF2LAlgorithms();
  const {
    ready: randomReady,
    all: allRandomSolves,
    solvesFor,
    bestFor: randomBestFor,
    ao5For: randomAo5For,
  } = useF2LRandomSolves();

  const grouped = F2L_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: ALL_F2LS.filter((d) => d.category === cat),
  }));

  const statsFor = (f2lId: F2LId) => {
    if (mode === 'random') {
      const solves = solvesFor(f2lId);
      const last = solves[0]?.recordedAt;
      return {
        best: randomBestFor(f2lId),
        ao5: randomAo5For(f2lId),
        last,
        count: solves.length,
      };
    }
    const star = algReady ? starredFor(f2lId) : null;
    const times = star?.times ?? [];
    return {
      best: bestSeconds(times),
      ao5: averageOfN(times, 5),
      last: times[0]?.recordedAt,
      count: times.length,
    };
  };

  const heading =
    mode === 'random' ? (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Random F2L Trainer</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Tap (or press Space) to draw a random F2L case in the Front-Right slot.
          {randomReady && (
            <span className="ml-2 text-xs">
              · {allRandomSolves.length} random solve{allRandomSolves.length === 1 ? '' : 's'} recorded
            </span>
          )}
        </p>
      </>
    ) : (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">All F2Ls</h1>
        <p className="text-sm text-zinc-500 mt-1">
          The 41 standard F2L cases (Front-Right slot). Pick a case to manage algorithms and times.
          {algReady && (
            <span className="ml-2 text-xs">
              · {allAlgorithms.length} algorithm{allAlgorithms.length === 1 ? '' : 's'} saved
            </span>
          )}
        </p>
      </>
    );

  return (
    <div className="space-y-8">
      <div>{heading}</div>

      {grouped.map(({ category, items }) => (
        <section key={category}>
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
            {F2L_CATEGORY_LABELS[category]}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((f2l) => {
              const star = algReady ? starredFor(f2l.id) : null;
              const algForDisplay = star?.algorithm ?? f2l.primaryAlg;
              const { best, ao5, last, count } = statsFor(f2l.id);
              return (
                <li key={f2l.id}>
                  <Link
                    href={`/f2l/${f2l.id}`}
                    className="group flex flex-col h-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-medium text-sm">F2L {f2l.number}</span>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${timeBadgeClasses(best)}`}
                      >
                        {formatSeconds(best)}
                      </span>
                    </div>
                    <div className="flex justify-center mb-2">
                      <div className="w-[120px] h-[120px]">
                        <F2L3DPlayer
                          algorithm={algForDisplay}
                          setupAlg={f2l.setupAlg}
                          interactive={false}
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 break-words leading-snug min-h-[2.5em] flex items-center justify-center text-center">
                      {star ? (
                        <span>
                          <span
                            className="text-amber-500 mr-1"
                            aria-label="Starred"
                            title="Starred"
                          >
                            ★
                          </span>
                          {star.algorithm}
                        </span>
                      ) : (
                        <span className="text-zinc-500">{f2l.primaryAlg}</span>
                      )}
                    </div>
                    {count > 0 && (
                      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span>
                          ao5{' '}
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {formatSeconds(ao5)}
                          </span>
                        </span>
                        <span aria-hidden>·</span>
                        <span title="Last recorded date">{formatLastDate(last)}</span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
