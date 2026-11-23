'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useTrainerMode, type TrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { setAutoAdvance } from '@/lib/smart-cube-settings-store';
import { RandomAufToggle } from './RandomAufToggle';
import { TrainerModeToggle } from './TrainerModeToggle';

const MODE_LABEL: Record<TrainerMode, MessageKey> = {
  standard: 'settings.trainerMode.standard',
  inverse: 'settings.trainerMode.inverse',
  'no-scramble': 'settings.trainerMode.noScramble',
};
const MODE_HELP: Record<TrainerMode, MessageKey> = {
  standard: 'settings.trainerMode.standardHelp',
  inverse: 'settings.trainerMode.inverseHelp',
  'no-scramble': 'settings.trainerMode.noScrambleHelp',
};

const chip = 'rounded-full bg-zinc-200/80 px-2.5 py-1 dark:bg-zinc-800';

// Random practice asks how to practise each time it opens: the mode, random
// AUF and, for no-scramble, whether the next case comes by itself. The last
// choices are kept (mode and AUF in the practice settings, the no-scramble
// ones on this device), so starting again takes one tap.
export function RandomPractice({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);
  if (!started) return <Options onStart={() => setStarted(true)} />;
  return (
    <>
      <Summary onChange={() => setStarted(false)} />
      {children}
    </>
  );
}

function Options({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const mode = useTrainerMode();
  const { autoAdvance } = useSmartCubeSettings();
  const start = useRef<HTMLButtonElement | null>(null);
  const onStartRef = useRef(onStart);
  useEffect(() => { onStartRef.current = onStart; });
  // Start has the focus, so Space or Enter starts straight away; Enter still
  // does after another option took the focus (Space keeps toggling it).
  useEffect(() => {
    start.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      onStartRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* m-auto centres the options, and keeps them reachable when they overflow. */}
      <div className="m-auto flex w-full max-w-md flex-col gap-5 px-1 py-6">
        <h3 className="text-lg font-semibold">{t('trainer.setup.title')}</h3>
        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t('settings.trainerMode.title')}</h4>
          <TrainerModeToggle />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(MODE_HELP[mode])}</p>
        </section>
        <section>
          <RandomAufToggle />
        </section>
        {mode === 'no-scramble' && (
          <section className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(event) => setAutoAdvance(event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              {t('trainer.setup.autoAdvance')}
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.setup.autoAdvanceHelp')}</p>
          </section>
        )}
        <button
          ref={start}
          type="button"
          onClick={onStart}
          className="rounded-md bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700"
        >
          {t('trainer.setup.start')}
        </button>
      </div>
    </div>
  );
}

// What the practice runs with, and the way back to change it.
function Summary({ onChange }: { onChange: () => void }) {
  const { t } = useT();
  const mode = useTrainerMode();
  const { settings } = usePracticeSettings();
  const { autoAdvance } = useSmartCubeSettings();
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 pb-2 text-xs text-zinc-600 dark:text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        <span className={chip}>{t(MODE_LABEL[mode])}</span>
        <span className={chip}>{t(settings.randomAuf ? 'settings.trainerMode.randomAufLabel' : 'trainer.setup.fixedAuf')}</span>
        {mode === 'no-scramble' && autoAdvance && <span className={chip}>{t('trainer.setup.autoAdvance')}</span>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded px-2 py-1 font-medium text-emerald-700 hover:underline dark:text-emerald-300"
      >
        {t('trainer.setup.change')}
      </button>
    </div>
  );
}
