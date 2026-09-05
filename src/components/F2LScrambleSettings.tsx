'use client';

import { useF2LScrambleSettings } from '@/hooks/useF2LScrambleSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { F2LScrambleStyle } from '@/lib/f2l-scramble';

const OPTIONS: { value: F2LScrambleStyle; label: MessageKey; title: MessageKey }[] = [
  { value: 'varied', label: 'settings.scramble.varied', title: 'settings.scramble.variedTitle' },
  { value: 'inverse', label: 'settings.scramble.inverse', title: 'settings.scramble.inverseTitle' },
];

export function F2LScrambleSettings() {
  const { settings, update } = useF2LScrambleSettings();
  const { t } = useT();
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={t('settings.scramble.aria')}
        className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === settings.style;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={t(opt.title)}
              onClick={() => update({ style: opt.value })}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t(opt.label)}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none">
        <input
          type="checkbox"
          checked={settings.randomAuf}
          onChange={(e) => update({ randomAuf: e.target.checked })}
          className="h-3.5 w-3.5 accent-emerald-600"
        />
        {t('settings.scramble.randomAuf')}
      </label>
    </div>
  );
}
