'use client';

import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { F2LAufDisplayMode } from '@/lib/f2l-auf-display-store';

const OPTIONS: { value: F2LAufDisplayMode; label: MessageKey; title: MessageKey }[] = [
  { value: 'cube', label: 'settings.aufDisplay.onCube', title: 'settings.aufDisplay.onCubeTitle' },
  {
    value: 'prefix',
    label: 'settings.aufDisplay.inAlgorithm',
    title: 'settings.aufDisplay.inAlgorithmTitle',
  },
];

export function F2LAufModeToggle() {
  const { mode, setMode } = useF2LAufDisplay();
  const { t } = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.aufDisplay.aria')}
      className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(opt.title)}
            onClick={() => setMode(opt.value)}
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
  );
}
