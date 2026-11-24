'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMounted } from '@/hooks/useMounted';
import { useT } from '@/hooks/useT';
import { HEADER_ACTIONS_ID, HEADER_TOOLBAR_ID } from '@/lib/header-slots';
import type { SelectionPreset } from '@/lib/selection-presets-store';
import { InfoTip } from './InfoTip';
import { SelectIcon } from './SelectIcon';
import { SelectionPresetsBar } from './SelectionPresetsBar';
import { ShuffleIcon } from './ShuffleIcon';

const OUTLINE = 'rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800';

// A list page's controls, in the app header: the page's (i) after the
// breadcrumb, then Select (an icon, with the number of cases shown when some
// are left out) and random practice. While selecting, the selection's tools
// take a second header row, so they stay in reach down a long list.
export function ListHeaderActions<Id extends string>({
  info, total, selection, presets, selectionMode, onSelectionModeChange, onRandom,
}: {
  info: ReactNode;
  total: number;
  selection: {
    selected: Set<Id>;
    count: number;
    selectAll: () => void;
    clear: () => void;
    replace: (ids: Iterable<Id>) => void;
  };
  presets: {
    presets: SelectionPreset<Id>[];
    save: (name: string, ids: Iterable<Id>) => unknown;
    remove: (presetId: string) => void;
  };
  selectionMode: boolean;
  onSelectionModeChange: (selecting: boolean) => void;
  onRandom: () => void;
}) {
  const { t } = useT();
  // The header's slots exist once the page is in the browser.
  const mounted = useMounted();
  if (!mounted) return null;
  const actions = document.getElementById(HEADER_ACTIONS_ID);
  const toolbar = document.getElementById(HEADER_TOOLBAR_ID);
  const leftOut = selection.count < total;
  const selectLabel = leftOut
    ? t('grid.selectShown', { count: selection.count, total })
    : t('common.select');

  return (
    <>
      {actions && createPortal(
        <>
          <InfoTip className="shrink-0">{info}</InfoTip>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-pressed={selectionMode}
              aria-label={selectLabel}
              title={selectLabel}
              onClick={() => onSelectionModeChange(!selectionMode)}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors ${
                selectionMode
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              <SelectIcon />
              {leftOut && !selectionMode && (
                <span aria-hidden className="absolute -right-1.5 -top-1.5 min-w-[1.125rem] rounded-full bg-emerald-600 px-1 text-center text-[10px] font-semibold leading-[1.125rem] text-white tabular-nums">
                  {selection.count}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onRandom}
              aria-label={t('common.randomTraining')}
              title={t('common.randomTraining')}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <ShuffleIcon />
              {/* Short on a phone, so the breadcrumb and both buttons keep to one row. */}
              <span className="sm:hidden">{t('common.randomShort')}</span>
              <span className="hidden sm:inline">{t('common.randomTraining')}</span>
            </button>
          </div>
        </>,
        actions,
      )}
      {toolbar && selectionMode && createPortal(
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 pb-3 text-sm sm:px-4">
          <span className="text-zinc-500">{t('grid.selectedForRandom', { count: selection.count, total })}</span>
          <button type="button" onClick={selection.selectAll} className={OUTLINE}>{t('common.selectAll')}</button>
          <button type="button" onClick={selection.clear} className={OUTLINE}>{t('common.clear')}</button>
          <SelectionPresetsBar
            presets={presets.presets}
            selected={selection.selected}
            selectionMode
            onLoad={selection.replace}
            onSave={presets.save}
            onDelete={presets.remove}
          />
          <button
            type="button"
            onClick={() => onSelectionModeChange(false)}
            className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
          >
            {t('common.done')}
          </button>
        </div>,
        toolbar,
      )}
    </>
  );
}
