'use client';

import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import type { PracticeSettings } from '@/lib/practice-settings-store';

const OPTIONS: { value: PracticeSettings['trainerMode']; label: MessageKey; title: MessageKey }[] = [
  {
    value: 'standard',
    label: 'settings.trainerMode.standard',
    title: 'settings.trainerMode.standardTitle',
  },
  {
    value: 'inverse',
    label: 'settings.trainerMode.inverse',
    title: 'settings.trainerMode.inverseTitle',
  },
];

export function TrainerModeToggle() {
  const { settings: { trainerMode: mode }, update } = usePracticeSettings();
  const { t } = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.trainerMode.aria')}
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
            onClick={() => update({ trainerMode: opt.value })}
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
