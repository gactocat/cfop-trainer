'use client';

import { choosePracticeMode, usePracticeMode, type PracticeMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';

const OPTIONS: { value: PracticeMode; label: MessageKey; title: MessageKey }[] = [
  { value: 'no-setup', label: 'practice.mode.noSetup', title: 'practice.mode.noSetupTitle' },
  { value: 'setup', label: 'practice.mode.withSetup', title: 'practice.mode.withSetupTitle' },
];

export function TrainerModeToggle() {
  const mode = usePracticeMode();
  const { t } = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('practice.mode.aria')}
      className="inline-flex flex-wrap rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
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
