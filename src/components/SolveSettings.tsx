'use client';

import { useState } from 'react';
import type { useSolveSettings } from '@/hooks/useSolveSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { STICKER_COLOURS } from '@/lib/cube-colors';
import { CUBE_COLOURS, fitsTop, type CubeColour } from '@/lib/smart-cube/holding';
import { AppModal } from './AppModal';
import { InfoTip } from './InfoTip';

export const COLOUR_LABEL: Record<CubeColour, MessageKey> = {
  white: 'solve.colour.white',
  yellow: 'solve.colour.yellow',
  red: 'solve.colour.red',
  orange: 'solve.colour.orange',
  green: 'solve.colour.green',
  blue: 'solve.colour.blue',
};

type Settings = ReturnType<typeof useSolveSettings>;

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

// How the cube is held for the scramble (the colours of the top and front
// faces; a front colour must sit beside the top one) and the inspection
// switch. The cross colour is read from each solve.
function SolveSettingsForm({ settings }: { settings: Settings }) {
  const { t } = useT();
  const readOnly = !settings.writable;
  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <h3 className="flex items-center gap-1 text-sm font-medium">
          {t('solve.settings.scramble')}
          <InfoTip>{t('solve.settings.scrambleHelp')}</InfoTip>
        </h3>
        <Swatches label={t('solve.settings.top')} value={settings.top} allowed={() => true}
          onPick={(top) => settings.set({ top })} disabled={readOnly} />
        <Swatches label={t('solve.settings.front')} value={settings.front} allowed={(colour) => fitsTop(settings.top, colour)}
          onPick={(front) => settings.set({ front })} disabled={readOnly} />
      </section>
      <section className="flex items-center gap-1 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <label className="flex items-center gap-2 text-sm font-medium select-none">
          <input
            type="checkbox"
            checked={settings.inspection}
            disabled={readOnly}
            onChange={(event) => settings.set({ inspection: event.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          {t('solve.settings.inspection')}
        </label>
        <InfoTip>{t('solve.settings.inspectionHelp')}</InfoTip>
      </section>
      {readOnly && <p className="text-xs text-amber-800 dark:text-amber-200">{t('solve.settings.readOnly')}</p>}
    </div>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// The solve's settings, behind a gear beside the scramble: how the cube is
// held for the scramble and the inspection. The gear is off while an
// attempt runs; the dialog itself holds the timers back (data-app-overlay).
export function SolveSettingsButton({ settings, disabled, className }: { settings: Settings; disabled: boolean; className: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}
        aria-label={t('solve.settings.title')} title={t('solve.settings.title')} aria-haspopup="dialog" className={className}>
        <GearIcon />
      </button>
      {open && (
        <AppModal title={t('solve.settings.title')} onClose={() => setOpen(false)}>
          <SolveSettingsForm settings={settings} />
        </AppModal>
      )}
    </>
  );
}
