'use client';

import { useMounted } from '@/hooks/useMounted';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useTrainerMode, type TrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { setNoScramble } from '@/lib/smart-cube-settings-store';
import { unsupportedReason } from '@/lib/smart-cube-store';

const OPTIONS: { value: TrainerMode; label: MessageKey; title: MessageKey }[] = [
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
  {
    value: 'no-scramble',
    label: 'settings.trainerMode.noScramble',
    title: 'settings.trainerMode.noScrambleTitle',
  },
];

export function TrainerModeToggle() {
  const { update } = usePracticeSettings();
  const mode = useTrainerMode();
  const mounted = useMounted();
  const { t } = useT();
  // No-scramble needs a smart cube, so it is offered only where one can connect.
  const noScrambleAvailable = mounted && unsupportedReason() === null;
  const choose = (value: TrainerMode) => {
    if (value === 'no-scramble') {
      setNoScramble(true);
      return;
    }
    // Standard and inverse stay in the synced practice settings, as before.
    setNoScramble(false);
    update({ trainerMode: value });
  };
  return (
    <div
      role="radiogroup"
      aria-label={t('settings.trainerMode.aria')}
      className="inline-flex flex-wrap rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        const disabled = opt.value === 'no-scramble' && !noScrambleAvailable;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={t(disabled ? 'settings.trainerMode.noScrambleUnavailable' : opt.title)}
            onClick={() => choose(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
