'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { TrainerFlavorContext, usePracticeMode, type TrainerFlavor } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { trainerFlavor } from '@/lib/practice-mode';
import { setAutoAdvance } from '@/lib/smart-cube-settings-store';
import { unsupportedReason } from '@/lib/smart-cube-store';
import { RandomAufToggle } from './RandomAufToggle';
import { SmartCubeConnect } from './SmartCubeConnect';
import { TrainerModeToggle } from './TrainerModeToggle';

/** Random practice draws from the selected cases; case practice repeats one case. */
export type PracticeScope = 'random' | 'case';

const MODE_LABEL: Record<TrainerFlavor, MessageKey> = {
  standard: 'practice.mode.noSetup',
  'no-scramble': 'practice.mode.noSetup',
  inverse: 'practice.mode.withSetup',
};

// How the practice will run, under the mode: with a cube connected, what the
// cube does.
function modeHelp(flavor: TrainerFlavor, connected: boolean, scope: PracticeScope): MessageKey {
  if (flavor === 'no-scramble') return 'practice.cube.noSetup';
  if (flavor === 'inverse') return connected ? 'practice.cube.setup' : 'practice.mode.withSetupHelp';
  return scope === 'case' ? 'practice.mode.noSetupHelpCase' : 'practice.mode.noSetupHelp';
}

const chip = 'rounded-full bg-zinc-200/80 px-2.5 py-1 dark:bg-zinc-800';

// A practice asks how to practise each time it opens: the mode, a smart cube,
// random AUF and, with a cube and no setup, whether the next case comes by
// itself. The last choices are kept (mode and AUF in the practice settings,
// the cube's options on this device), so starting again takes one tap. How
// the practice runs is fixed when it starts (see TrainerFlavorContext).
export function PracticeSession({ children, scope = 'random', subject }: {
  children: ReactNode;
  scope?: PracticeScope;
  /** Shown under the title, e.g. the algorithm a case practice uses. */
  subject?: ReactNode;
}) {
  const [flavor, setFlavor] = useState<TrainerFlavor | null>(null);
  if (!flavor) return <Options scope={scope} subject={subject} onStart={setFlavor} />;
  return (
    <TrainerFlavorContext.Provider value={flavor}>
      <Summary flavor={flavor} onChange={() => setFlavor(null)} />
      {children}
    </TrainerFlavorContext.Provider>
  );
}

function Options({ scope, subject, onStart }: {
  scope: PracticeScope;
  subject?: ReactNode;
  onStart: (flavor: TrainerFlavor) => void;
}) {
  const { t } = useT();
  const mounted = useMounted();
  const mode = usePracticeMode();
  const connected = useSmartCube().status === 'connected';
  const flavor = trainerFlavor(mode, connected);
  const { autoAdvance } = useSmartCubeSettings();
  const cubeAvailable = mounted && unsupportedReason() === null;
  const start = useRef<HTMLButtonElement | null>(null);
  const startNow = () => onStart(flavor);
  const startRef = useRef(startNow);
  useEffect(() => { startRef.current = startNow; });
  // Start has the focus, so Space or Enter starts straight away; Enter still
  // does after a mode or checkbox took the focus (Space keeps toggling it).
  // The smart cube controls and its dialog keep Enter for themselves.
  useEffect(() => {
    start.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      if (document.querySelector('[data-app-overlay]')) return;
      if ((event.target as Element | null)?.closest?.('[data-own-enter]')) return;
      event.preventDefault();
      startRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* m-auto centres the options, and keeps them reachable when they overflow. */}
      <div className="m-auto flex w-full max-w-md flex-col gap-5 px-1 py-6">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('trainer.setup.title')}</h3>
          {subject}
        </div>
        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t('practice.mode.title')}</h4>
          <TrainerModeToggle />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(modeHelp(flavor, connected, scope))}</p>
        </section>
        <section className="space-y-2">
          <h4 className="text-sm font-medium">{t('smartCube.title')}</h4>
          <div data-own-enter>
            <SmartCubeConnect />
          </div>
          {cubeAvailable && !connected && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t(mode === 'setup' ? 'practice.cube.offerSetup' : 'practice.cube.offerNoSetup')}
            </p>
          )}
          {flavor === 'no-scramble' && (
            <div className="space-y-1 pt-1">
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
            </div>
          )}
        </section>
        <section>
          <RandomAufToggle />
        </section>
        {/* Sized like the app's other primary buttons, at the end of the form. */}
        <div className="flex justify-end">
          <button
            ref={start}
            type="button"
            onClick={startNow}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 font-medium"
          >
            {t('trainer.setup.start')}
          </button>
        </div>
      </div>
    </div>
  );
}

// What the practice runs with, and the way back to change it.
function Summary({ flavor, onChange }: { flavor: TrainerFlavor; onChange: () => void }) {
  const { t } = useT();
  const { settings } = usePracticeSettings();
  const { autoAdvance } = useSmartCubeSettings();
  const connected = useSmartCube().status === 'connected';
  // No-scramble runs on the cube even while it reconnects; inverse uses it when there.
  const withCube = flavor === 'no-scramble' || (flavor === 'inverse' && connected);
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 pb-2 text-xs text-zinc-600 dark:text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        <span className={chip}>{t(MODE_LABEL[flavor])}</span>
        {withCube && <span className={chip}>{t('smartCube.title')}</span>}
        <span className={chip}>{t(settings.randomAuf ? 'settings.trainerMode.randomAufLabel' : 'trainer.setup.fixedAuf')}</span>
        {flavor === 'no-scramble' && autoAdvance && <span className={chip}>{t('trainer.setup.autoAdvance')}</span>}
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
