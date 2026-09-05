'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ALL_PLLS } from '@/data/pll-definitions';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { usePllRandomSelection } from '@/hooks/usePllRandomSelection';
import { useMounted } from '@/hooks/useMounted';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { PllLLView } from './PllLLView';
import { PLL_IDS, type PllCategory, type PllId } from '@/types/pll';

const CATEGORY_KEYS: Record<PllCategory, MessageKey> = {
  epll: 'pll.category.epll',
  cpll: 'pll.category.cpll',
  'ec-pll': 'pll.category.ec-pll',
};

const CATEGORY_ORDER: PllCategory[] = ['epll', 'cpll', 'ec-pll'];

function timeBadgeClasses(seconds: number | null): string {
  if (seconds === null) return 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
  if (seconds < 2.5) return 'bg-emerald-500 text-white';
  if (seconds < 3.5) return 'bg-emerald-300 text-emerald-950';
  if (seconds < 4.5) return 'bg-amber-300 text-amber-950';
  return 'bg-rose-400 text-rose-950';
}

function formatLastDate(iso: string | undefined, intl: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(intl, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function PllGrid() {
  const { ready: algReady, starredFor, all: allAlgorithms } = useAlgorithms();
  const selection = usePllRandomSelection();
  const { t, tn, intl } = useT();
  const mounted = useMounted();
  const [selectionMode, setSelectionMode] = useState(false);
  // Checkboxes only render in selection mode (and after mount so SSR/hydration
  // markup matches — the store returns "all selected" only on the client).
  const showSelect = mounted && selectionMode;
  // Normal mode hides deselected cases; selection mode (and pre-mount) shows
  // every case.
  const visibleFor = (items: typeof ALL_PLLS) =>
    mounted && !selectionMode ? items.filter((p) => selection.isSelected(p.id)) : items;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: ALL_PLLS.filter((p) => p.category === cat),
  }));

  const totalVisible = mounted && !selectionMode ? selection.count : ALL_PLLS.length;

  // Card stats come from the starred algorithm's recorded times.
  const statsFor = (pllId: PllId) => {
    const star = algReady ? starredFor(pllId) : null;
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
      <h1 className="text-2xl font-semibold tracking-tight">{t('pll.grid.title')}</h1>
      <p className="text-sm text-zinc-500 mt-1">
        {t('pll.grid.description')}
        {algReady && (
          <span className="ml-2 text-xs">
            · {tn('common.algorithmsSaved', allAlgorithms.length)}
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
                {t('grid.selectedForRandom', { count: selection.count, total: PLL_IDS.length })}
              </span>
              <button
                type="button"
                onClick={selection.selectAll}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t('common.selectAll')}
              </button>
              <button
                type="button"
                onClick={selection.clear}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t('common.clear')}
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode(false)}
                className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-xs font-medium"
              >
                {t('common.done')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectionMode(true)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t('common.selectCases')}
              </button>
              <span className="text-zinc-500 text-xs">
                {t('grid.shown', { count: selection.count, total: PLL_IDS.length })}
              </span>
            </>
          )}
        </div>
      )}

      {mounted && !selectionMode && totalVisible === 0 && (
        <p className="text-sm text-zinc-500 py-6 text-center">{t('pll.grid.noneSelected')}</p>
      )}

      {grouped.map(({ category, items }) => {
        const visible = visibleFor(items);
        if (visible.length === 0) return null;
        return (
        <section key={category}>
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
            {t(CATEGORY_KEYS[category])}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {visible.map((pll) => {
              const star = algReady ? starredFor(pll.id) : null;
              const { best, ao5, last, count } = statsFor(pll.id);
              const displayAuf = star?.auf ?? 'U0';
              return (
                <li key={pll.id}>
                  <Link
                    href={`/pll/${pll.id}`}
                    className={`group flex flex-col h-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors ${
                      showSelect && !selection.isSelected(pll.id) ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="flex items-center gap-2 min-w-0">
                        {showSelect && (
                          <input
                            type="checkbox"
                            checked={selection.isSelected(pll.id)}
                            onChange={() => selection.toggle(pll.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 shrink-0 accent-emerald-600 cursor-pointer"
                            aria-label={t('pll.grid.includeInRandom', { name: pll.name })}
                          />
                        )}
                        <span className="font-medium text-sm">{pll.name}</span>
                      </span>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${timeBadgeClasses(best)}`}
                      >
                        {formatSeconds(best)}
                      </span>
                    </div>
                    <div className="flex justify-center mb-2">
                      <PllLLView pllId={pll.id} auf={displayAuf} size={96} />
                    </div>
                    <div className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 break-words leading-snug min-h-[2.5em] flex items-center justify-center text-center">
                      {star ? (
                        <span>
                          <span
                            className="text-amber-500 mr-1"
                            aria-label={t('common.starred')}
                            title={t('common.starred')}
                          >
                            ★
                          </span>
                          {star.algorithm}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">{t('pll.grid.noAlgorithm')}</span>
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
                        <span title={t('common.lastRecordedDate')}>{formatLastDate(last, intl)}</span>
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
