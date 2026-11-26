'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ALL_PLLS } from '@/data/pll-definitions';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { usePllRandomSelection } from '@/hooks/usePllRandomSelection';
import { useMounted } from '@/hooks/useMounted';
import { useSelectionPresets } from '@/hooks/useSelectionPresets';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { pllSelectionPresets } from '@/lib/pll-selection-presets-store';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { ListHeaderActions } from './ListHeaderActions';
import { PllLLView } from './PllLLView';
import { PLL_IDS, type PllCategory, type PllId } from '@/types/pll';

const CARD_CLASS =
  'group flex flex-col h-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 sm:p-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors';

// Cards at least 10rem wide fill each row: two across on a phone held
// upright (360 to 500 px), more on wider screens. The case view inside is
// 144 px, which fits the narrowest card.
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2 sm:gap-3';

const CATEGORY_KEYS: Record<PllCategory, MessageKey> = {
  epll: 'pll.category.epll',
  cpll: 'pll.category.cpll',
  'ec-pll': 'pll.category.ec-pll',
};

const CATEGORY_ORDER: PllCategory[] = ['epll', 'cpll', 'ec-pll'];

function timeBadgeClasses(seconds: number): string {
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

export function PllGrid({ onRandom }: { onRandom: () => void }) {
  const { ready: algReady, starredFor } = useAlgorithms();
  const selection = usePllRandomSelection();
  const presets = useSelectionPresets(pllSelectionPresets);
  const { t, intl } = useT();
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

  return (
    <div className="space-y-8">
      {/* The page title is in the header; Select and random practice sit beside it. */}
      <h1 className="sr-only">{t('pll.grid.title')}</h1>
      <ListHeaderActions
        practice="pll"
        info={<>
          <span className="block">{t('pll.grid.description')}</span>
          <span className="block">{t('grid.help')}</span>
        </>}
        total={PLL_IDS.length}
        selection={selection}
        presets={presets}
        selectionMode={selectionMode}
        onSelectionModeChange={setSelectionMode}
        onRandom={onRandom}
      />

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
          <ul className={GRID_CLASS}>
            {visible.map((pll) => {
              const star = algReady ? starredFor(pll.id) : null;
              const { best, ao5, last, count } = statsFor(pll.id);
              const displayAuf = star?.auf ?? 'U0';
              const isSelected = selection.isSelected(pll.id);
              // In selection mode the whole card is the toggle (a checkbox
              // alone is too small a target on a phone), so it stops being a
              // link to the detail page until selection is done.
              const card = (
                <>
                    <div className="flex flex-wrap items-start justify-between gap-1 mb-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {showSelect && (
                          <span
                            aria-hidden
                            className={`h-5 w-5 shrink-0 rounded border flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-zinc-400 dark:border-zinc-600'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                        )}
                        <span className="font-medium text-sm">{pll.name}</span>
                      </span>
                      {best !== null && (
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${timeBadgeClasses(best)}`}>
                          {formatSeconds(best)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-center mb-2">
                      <PllLLView pllId={pll.id} auf={displayAuf} algorithm={star?.algorithm} size={144} />
                    </div>
                    {count > 0 && (
                      <div className="mt-auto pt-2 flex flex-wrap items-center justify-center gap-x-2 text-[11px] text-zinc-500 font-mono">
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
                </>
              );
              return (
                <li key={pll.id}>
                  {showSelect ? (
                    <div
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={t('pll.grid.includeInRandom', { name: pll.name })}
                      tabIndex={0}
                      onClick={() => selection.toggle(pll.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          selection.toggle(pll.id);
                        }
                      }}
                      className={`${CARD_CLASS} cursor-pointer select-none ${
                        isSelected
                          ? 'border-emerald-500 dark:border-emerald-500 ring-1 ring-emerald-500'
                          : 'opacity-50'
                      }`}
                    >
                      {card}
                    </div>
                  ) : (
                    <Link href={`/pll/${pll.id}`} className={CARD_CLASS}>
                      {card}
                    </Link>
                  )}
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
