'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ALL_F2LS,
  F2L_CATEGORY_LABELS,
  F2L_CATEGORY_ORDER,
} from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import { useMounted } from '@/hooks/useMounted';
import { useF2LRandomSelection } from '@/hooks/useF2LRandomSelection';
import { prefixAuf } from '@/lib/f2l-auf';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { F2L3DPlayer } from './F2L3DPlayer';
import { F2L_IDS, type F2LId } from '@/types/f2l';

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

export function F2LGrid() {
  const { ready: algReady, starredFor, all: allAlgorithms } = useF2LAlgorithms();
  const selection = useF2LRandomSelection();
  const { mode: aufMode } = useF2LAufDisplay();
  const mounted = useMounted();
  const [selectionMode, setSelectionMode] = useState(false);
  // Checkboxes only render in selection mode (and after mount so SSR/hydration
  // markup matches — the store returns "all selected" only on the client).
  const showSelect = mounted && selectionMode;
  // Normal mode hides deselected cases; selection mode (and pre-mount, so the
  // SSR/hydration output matches) shows every case.
  const visibleFor = (items: typeof ALL_F2LS) =>
    mounted && !selectionMode ? items.filter((d) => selection.isSelected(d.id)) : items;

  const grouped = F2L_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: ALL_F2LS.filter((d) => d.category === cat),
  }));

  const totalVisible = mounted && !selectionMode ? selection.count : ALL_F2LS.length;

  const statsFor = (f2lId: F2LId) => {
    const star = algReady ? starredFor(f2lId) : null;
    const times = star?.times ?? [];
    return {
      best: bestSeconds(times),
      ao5: averageOfN(times, 5),
      last: times[0]?.recordedAt,
      count: times.length,
    };
  };

  const heading = (
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

      {mounted && (
        <div className="flex items-center gap-3 text-sm flex-wrap">
          {selectionMode ? (
            <>
              <span className="text-zinc-500">
                {selection.count}/{F2L_IDS.length} selected for random
              </span>
              <button
                type="button"
                onClick={selection.selectAll}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={selection.clear}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode(false)}
                className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-xs font-medium"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Select cases
              </button>
              <span className="text-zinc-500 text-xs">
                {selection.count}/{F2L_IDS.length} shown
              </span>
            </>
          )}
        </div>
      )}

      {mounted && !selectionMode && totalVisible === 0 && (
        <p className="text-sm text-zinc-500 py-6 text-center">
          No cases selected. Tap “Select cases” to choose which F2L cases to show.
        </p>
      )}

      {grouped.map(({ category, items }) => {
        const visible = visibleFor(items);
        if (visible.length === 0) return null;
        return (
        <section key={category}>
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
            {F2L_CATEGORY_LABELS[category]}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map((f2l) => {
              const star = algReady ? starredFor(f2l.id) : null;
              const algForDisplay = star?.algorithm ?? f2l.primaryAlg;
              const { best, ao5, last, count } = statsFor(f2l.id);
              return (
                <li key={f2l.id}>
                  <Link
                    href={`/f2l/${f2l.id}`}
                    className={`group flex flex-col h-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors ${
                      showSelect && !selection.isSelected(f2l.id) ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="flex items-center gap-2 min-w-0">
                        {showSelect && (
                          <input
                            type="checkbox"
                            checked={selection.isSelected(f2l.id)}
                            onChange={() => selection.toggle(f2l.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer"
                            aria-label={`Include F2L ${f2l.number} in random selection`}
                          />
                        )}
                        <span className="font-medium text-sm">F2L {f2l.number}</span>
                      </span>
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
                          auf={star?.auf ?? 'U0'}
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
                          {aufMode === 'prefix'
                            ? prefixAuf(star.auf, star.algorithm)
                            : star.algorithm}
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
        );
      })}
    </div>
  );
}
