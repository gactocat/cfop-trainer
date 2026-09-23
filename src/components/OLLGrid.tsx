'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ALL_OLLS } from '@/data/oll-definitions';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useOLLRandomSelection } from '@/hooks/useOLLRandomSelection';
import { useMounted } from '@/hooks/useMounted';
import { useSelectionPresets } from '@/hooks/useSelectionPresets';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { prefixAuf } from '@/lib/f2l-auf';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { ollSelectionPresets } from '@/lib/oll-selection-presets-store';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { OLLLLView } from './OLLLLView';
import { SelectionPresetsBar } from './SelectionPresetsBar';
import { OLL_IDS, type OLLCategory, type OLLId } from '@/types/oll';
import { InfoTip } from './InfoTip';

const CARD_CLASS =
  'group flex flex-col h-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors';

const CATEGORY_KEYS: Record<OLLCategory, MessageKey> = {
  'dot-case': 'oll.category.dot-case',
  'square-shapes': 'oll.category.square-shapes',
  'lightning-shapes': 'oll.category.lightning-shapes',
  'fish-shapes': 'oll.category.fish-shapes',
  'knight-move-shapes': 'oll.category.knight-move-shapes',
  'ocll': 'oll.category.ocll',
  'all-corners-oriented': 'oll.category.all-corners-oriented',
  'awkward-shapes': 'oll.category.awkward-shapes',
  'p-shapes': 'oll.category.p-shapes',
  't-shapes': 'oll.category.t-shapes',
  'c-shapes': 'oll.category.c-shapes',
  'w-shapes': 'oll.category.w-shapes',
  'l-shapes': 'oll.category.l-shapes',
  'line-shapes': 'oll.category.line-shapes',
};

const CATEGORY_ORDER: OLLCategory[] = ["dot-case", "square-shapes", "lightning-shapes", "fish-shapes", "knight-move-shapes", "ocll", "all-corners-oriented", "awkward-shapes", "p-shapes", "t-shapes", "c-shapes", "w-shapes", "l-shapes", "line-shapes"];

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

export function OLLGrid() {
  const { ready: algReady, starredFor, all: allAlgorithms } = useOLLAlgorithms();
  const selection = useOLLRandomSelection();
  const presets = useSelectionPresets(ollSelectionPresets);
  const { t, tn, intl } = useT();
  const { settings } = usePracticeSettings();
  const mounted = useMounted();
  const [selectionMode, setSelectionMode] = useState(false);
  // Checkboxes only render in selection mode (and after mount so SSR/hydration
  // markup matches — the store returns "all selected" only on the client).
  const showSelect = mounted && selectionMode;
  // Normal mode hides deselected cases; selection mode (and pre-mount) shows
  // every case.
  const visibleFor = (items: typeof ALL_OLLS) =>
    mounted && !selectionMode ? items.filter((p) => selection.isSelected(p.id)) : items;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: ALL_OLLS.filter((p) => p.category === cat),
  }));

  const totalVisible = mounted && !selectionMode ? selection.count : ALL_OLLS.length;

  // Card stats come from the starred algorithm's recorded times.
  const statsFor = (ollId: OLLId) => {
    const star = algReady ? starredFor(ollId) : null;
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
      <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
        {t('oll.grid.title')}
        <InfoTip>
          <span className="block">{t('oll.grid.description')}</span>
          <span className="block">{t('grid.help')}</span>
        </InfoTip>
      </h1>
      {algReady && (
        <p className="text-xs text-zinc-500 mt-1">
          {tn('common.algorithmsSaved', allAlgorithms.length)}
        </p>
      )}
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
                {t('grid.selectedForRandom', { count: selection.count, total: OLL_IDS.length })}
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
                {t('grid.shown', { count: selection.count, total: OLL_IDS.length })}
              </span>
            </>
          )}
          <SelectionPresetsBar
            presets={presets.presets}
            selected={selection.selected}
            selectionMode={selectionMode}
            onLoad={selection.replace}
            onSave={presets.save}
            onDelete={presets.remove}
          />
        </div>
      )}

      {mounted && !selectionMode && totalVisible === 0 && (
        <p className="text-sm text-zinc-500 py-6 text-center">{t('oll.grid.noneSelected')}</p>
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
            {visible.map((oll) => {
              const star = algReady ? starredFor(oll.id) : null;
              const { best, ao5, last, count } = statsFor(oll.id);
              const displayAuf = star?.auf ?? 'U0';
              const isSelected = selection.isSelected(oll.id);
              // In selection mode the whole card is the toggle (a checkbox
              // alone is too small a target on a phone), so it stops being a
              // link to the detail page until selection is done.
              const card = (
                <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="flex items-center gap-2 min-w-0">
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
                        <span className="font-medium text-sm">{oll.name}</span>
                      </span>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${timeBadgeClasses(best)}`}
                      >
                        {formatSeconds(best)}
                      </span>
                    </div>
                    <div className="flex justify-center mb-2">
                      <OLLLLView ollId={oll.id} auf={displayAuf} algorithm={star?.algorithm} size={96} />
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
                          {settings.aufDisplay === 'prefix' ? prefixAuf(star.auf, star.algorithm) : star.algorithm}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic">{t('oll.grid.noAlgorithm')}</span>
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
                </>
              );
              return (
                <li key={oll.id}>
                  {showSelect ? (
                    <div
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={t('oll.grid.includeInRandom', { name: oll.name })}
                      tabIndex={0}
                      onClick={() => selection.toggle(oll.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          selection.toggle(oll.id);
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
                    <Link href={`/oll/${oll.id}`} className={CARD_CLASS}>
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
