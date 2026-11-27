'use client';

import { useState } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { usePracticeOptions } from '@/hooks/usePracticeRound';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { usePracticeMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { isCubeFlavor, trainerFlavor, type TrainerFlavor } from '@/lib/practice-mode';
import { setAutoAdvance } from '@/lib/smart-cube-settings-store';
import { unsupportedReason } from '@/lib/smart-cube-store';
import { AppModal } from './AppModal';
import { AufStartToggle } from './AufStartToggle';
import { InfoTip } from './InfoTip';
import { SmartCubeConnect } from './SmartCubeConnect';
import { GearIcon } from './SolveSettings';
import { PRACTICE_MODE_OPTIONS, TrainerModeToggle } from './TrainerModeToggle';

/** Random practice draws from the selected cases; case practice repeats one case. */
export type PracticeScope = 'random' | 'case';

// How a mode runs, in the mode's (i): with a cube connected, what the cube does.
function modeHelp(flavor: TrainerFlavor, scope: PracticeScope): MessageKey {
  if (flavor === 'no-scramble') return 'practice.cube.noSetup';
  if (flavor === 'smart-setup') return 'practice.cube.setup';
  if (flavor === 'inverse') return 'practice.mode.withSetupHelp';
  return scope === 'case' ? 'practice.mode.noSetupHelpCase' : 'practice.mode.noSetupHelp';
}

// How to practise: the smart cube, the mode (with or without setup), the
// AUF, with a cube whether the next case comes by itself, and for random
// practice whether to take each selected case once. Kept as chosen (mode
// and AUF in the practice settings, the others on this device); a change
// takes effect with the next case (at once while a case waits).
function PracticeSettingsForm({ scope }: { scope: PracticeScope }) {
  const { t } = useT();
  const mounted = useMounted();
  const mode = usePracticeMode();
  const connected = useSmartCube().status === 'connected';
  const flavor = trainerFlavor(mode, connected);
  const { autoAdvance } = useSmartCubeSettings();
  const { eachOnce, setEachOnce } = usePracticeOptions();
  const cubeAvailable = mounted && unsupportedReason() === null;
  const check = 'h-4 w-4 accent-emerald-600';
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="flex items-center gap-1 text-sm font-medium">
          {t('smartCube.title')}
          {cubeAvailable && !connected && (
            <InfoTip>{t(mode === 'setup' ? 'practice.cube.offerSetup' : 'practice.cube.offerNoSetup')}</InfoTip>
          )}
        </h3>
        <SmartCubeConnect />
      </section>
      <section className="space-y-2">
        <h3 className="flex items-center gap-1 text-sm font-medium">
          {t('practice.mode.title')}
          <InfoTip>
            {PRACTICE_MODE_OPTIONS.map((option) => (
              <span key={option.value} className="block">
                <span className="font-medium text-zinc-800 dark:text-zinc-100">{t(option.label)}</span>
                {' — '}{t(modeHelp(trainerFlavor(option.value, connected), scope))}
              </span>
            ))}
          </InfoTip>
        </h3>
        <TrainerModeToggle />
      </section>
      <section>
        <AufStartToggle />
      </section>
      {(isCubeFlavor(flavor) || scope === 'random') && (
        <section className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {isCubeFlavor(flavor) && (
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-2 text-sm font-medium select-none">
                <input type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} className={check} />
                {t('trainer.setup.autoAdvance')}
              </label>
              <InfoTip>{t('trainer.setup.autoAdvanceHelp')}</InfoTip>
            </div>
          )}
          {scope === 'random' && (
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-2 text-sm font-medium select-none">
                <input type="checkbox" checked={mounted && eachOnce} onChange={(event) => setEachOnce(event.target.checked)} className={check} />
                {t('practice.round.label')}
              </label>
              <InfoTip>{t('practice.round.help')}</InfoTip>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// The practice's settings, behind a gear on the case screen as the solve's
// are beside its scramble. The dialog holds the timers back (data-app-overlay).
export function PracticeSettingsButton({ scope, className }: { scope: PracticeScope; className: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={t('trainer.setup.title')} title={t('trainer.setup.title')} aria-haspopup="dialog" className={className}>
        <GearIcon />
      </button>
      {open && (
        <AppModal title={t('trainer.setup.title')} onClose={() => setOpen(false)}>
          <PracticeSettingsForm scope={scope} />
        </AppModal>
      )}
    </>
  );
}
