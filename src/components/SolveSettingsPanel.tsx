'use client';

import { useId, useState } from 'react';
import type { useSolveSettings } from '@/hooks/useSolveSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { STICKER_COLOURS } from '@/lib/cube-colors';
import { CUBE_COLOURS, fitsTop, type CubeColour } from '@/lib/smart-cube/holding';

export const COLOUR_LABEL: Record<CubeColour, MessageKey> = {
  white: 'solve.colour.white',
  yellow: 'solve.colour.yellow',
  red: 'solve.colour.red',
  orange: 'solve.colour.orange',
  green: 'solve.colour.green',
  blue: 'solve.colour.blue',
};

function Swatches({ label, value, allowed, onPick, disabled }: {
  label: string;
  value: CubeColour;
  allowed: (colour: CubeColour) => boolean;
  onPick: (colour: CubeColour) => void;
  disabled: boolean;
}) {
  const { t } = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      <span className="flex flex-wrap gap-1.5">
        {CUBE_COLOURS.map((colour) => {
          const on = colour === value;
          const ok = allowed(colour);
          return (
            <button
              key={colour}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t(COLOUR_LABEL[colour])}
              title={t(COLOUR_LABEL[colour])}
              disabled={disabled || !ok}
              onClick={() => onPick(colour)}
              className={`size-7 rounded-md border transition disabled:cursor-not-allowed disabled:opacity-25 ${on
                ? 'border-zinc-900 ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:border-zinc-100 dark:ring-zinc-100 dark:ring-offset-zinc-900'
                : 'border-zinc-300 dark:border-zinc-600'}`}
              style={{ backgroundColor: STICKER_COLOURS[colour] }}
            />
          );
        })}
      </span>
    </div>
  );
}

// The solve's holding and inspection, under the scramble: one line saying
// how it is set, which opens to the colours of the top and front faces (a
// front colour must sit beside the top one) and the inspection switch.
export function SolveSettingsPanel({ settings, disabled }: { settings: ReturnType<typeof useSolveSettings>; disabled: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const panel = useId();
  const holding = t('solve.holding', { top: t(COLOUR_LABEL[settings.top]), front: t(COLOUR_LABEL[settings.front]) });
  const readOnly = !settings.writable;
  return (
    <div className="w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        title={t('solve.settings.show')}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-1 rounded text-left text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <span>
          {t('solve.scramble.holding', { holding })}
          {settings.inspection && <> · {t('solve.settings.inspectionOn')}</>}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={panel} className="mt-3 space-y-3 rounded-lg border border-zinc-200 p-3 text-left dark:border-zinc-800">
          <Swatches label={t('solve.settings.top')} value={settings.top} allowed={() => true}
            onPick={(top) => settings.set({ top })} disabled={disabled || readOnly} />
          <Swatches label={t('solve.settings.front')} value={settings.front} allowed={(colour) => fitsTop(settings.top, colour)}
            onPick={(front) => settings.set({ front })} disabled={disabled || readOnly} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('solve.settings.holdingHelp')}</p>
          <label className="flex items-center gap-2 border-t border-zinc-100 pt-3 text-sm font-medium dark:border-zinc-800">
            <input
              type="checkbox"
              checked={settings.inspection}
              disabled={disabled || readOnly}
              onChange={(event) => settings.set({ inspection: event.target.checked })}
              className="h-4 w-4 accent-emerald-600"
            />
            {t('solve.settings.inspection')}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('solve.settings.inspectionHelp')}</p>
          {readOnly && <p className="text-xs text-amber-800 dark:text-amber-200">{t('solve.settings.readOnly')}</p>}
        </div>
      )}
    </div>
  );
}
