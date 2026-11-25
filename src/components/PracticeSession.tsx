'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { usePracticeRun, PracticeRunContext, usePracticeOptions } from '@/hooks/usePracticeRun';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { TrainerFlavorContext, usePracticeMode, type TrainerFlavor } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { aufStartOf } from '@/lib/auf-start';
import { isCubeFlavor, trainerFlavor } from '@/lib/practice-mode';
import { setAutoAdvance } from '@/lib/smart-cube-settings-store';
import { unsupportedReason } from '@/lib/smart-cube-store';
import { getTimerFocus, getTimerFocusServerSnapshot, subscribeTimerFocus } from '@/lib/timer-focus';
import { AUF_START_LABEL, AufStartToggle } from './AufStartToggle';
import { SmartCubeConnect } from './SmartCubeConnect';
import { TrainerModeToggle } from './TrainerModeToggle';

/** Random practice draws from the selected cases; case practice repeats one case. */
export type PracticeScope = 'random' | 'case';

const MODE_LABEL: Record<TrainerFlavor, MessageKey> = {
  standard: 'practice.mode.noSetup',
  'no-scramble': 'practice.mode.noSetup',
  inverse: 'practice.mode.withSetup',
  'smart-setup': 'practice.mode.withSetup',
};

// How the practice will run, under the mode: with a cube connected, what the
// cube does.
function modeHelp(flavor: TrainerFlavor, scope: PracticeScope): MessageKey {
  if (flavor === 'no-scramble') return 'practice.cube.noSetup';
  if (flavor === 'smart-setup') return 'practice.cube.setup';
  if (flavor === 'inverse') return 'practice.mode.withSetupHelp';
  return scope === 'case' ? 'practice.mode.noSetupHelpCase' : 'practice.mode.noSetupHelp';
}

const chip = 'rounded-full bg-zinc-200/80 px-2.5 py-1 dark:bg-zinc-800';

// A practice asks how to practise each time it opens: the mode, a smart cube,
// random AUF, with a cube whether the next case comes by itself, and for
// random practice whether to take each selected case once. The last choices
// are kept (mode and AUF in the practice settings, the others on this
// device), so starting again takes one tap. How the practice runs is fixed
// when it starts (see TrainerFlavorContext and PracticeRunContext); each
// start is a new session.
export function PracticeSession({ children, scope = 'random', subject }: {
  children: ReactNode;
  scope?: PracticeScope;
  /** Shown under the title, e.g. the algorithm a case practice uses. */
  subject?: ReactNode;
}) {
  const [started, setStarted] = useState<{ flavor: TrainerFlavor; eachOnce: boolean } | null>(null);
  const { eachOnce } = usePracticeOptions();
  const run = useMemo(() => ({ eachOnce: started?.eachOnce ?? false, finish: () => setStarted(null) }), [started]);
  if (!started) {
    return <Options scope={scope} subject={subject} onStart={(flavor) => setStarted({ flavor, eachOnce: scope === 'random' && eachOnce })} />;
  }
  return (
    <TrainerFlavorContext.Provider value={started.flavor}>
      <PracticeRunContext.Provider value={run}>
        <Summary flavor={started.flavor} onChange={run.finish} />
        {children}
      </PracticeRunContext.Provider>
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
  const { eachOnce, setEachOnce } = usePracticeOptions();
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
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(modeHelp(flavor, scope))}</p>
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
          {isCubeFlavor(flavor) && (
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
          <AufStartToggle />
        </section>
        {scope === 'random' && (
          <section className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium select-none">
              <input
                type="checkbox"
                checked={mounted && eachOnce}
                onChange={(event) => setEachOnce(event.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              {t('practice.round.label')}
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('practice.round.help')}</p>
          </section>
        )}
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
  const { eachOnce } = usePracticeRun();
  // Steps aside while the timer is held or running.
  const focus = useSyncExternalStore(subscribeTimerFocus, getTimerFocus, getTimerFocusServerSnapshot);
  // Runs on the cube even while it reconnects.
  const withCube = isCubeFlavor(flavor);
  return (
    <div className={`flex shrink-0 items-center justify-between gap-2 pb-2 text-xs text-zinc-600 dark:text-zinc-300 ${focus ? 'invisible' : ''}`}>
      <div className="flex flex-wrap gap-1.5">
        <span className={chip}>{t(MODE_LABEL[flavor])}</span>
        {withCube && <span className={chip}>{t('smartCube.title')}</span>}
        <span className={chip}>{t('practice.auf.chip', { choice: t(AUF_START_LABEL[aufStartOf(settings)]) })}</span>
        {withCube && autoAdvance && <span className={chip}>{t('trainer.setup.autoAdvance')}</span>}
        {eachOnce && <span className={chip}>{t('practice.round.chip')}</span>}
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
