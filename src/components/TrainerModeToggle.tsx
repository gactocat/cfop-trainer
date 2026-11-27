'use client';

import { choosePracticeMode, usePracticeMode, type PracticeMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';

export const PRACTICE_MODE_OPTIONS: { value: PracticeMode; label: MessageKey; title: MessageKey }[] = [
  { value: 'setup', label: 'practice.mode.on', title: 'practice.mode.withSetupTitle' },
  { value: 'no-setup', label: 'practice.mode.off', title: 'practice.mode.noSetupTitle' },
];

export function TrainerModeToggle() {
  const mode = usePracticeMode();
  const { t } = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('practice.mode.title')}
      className="inline-flex flex-wrap rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
    >
      {PRACTICE_MODE_OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(opt.title)}
            onClick={() => choosePracticeMode(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
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
