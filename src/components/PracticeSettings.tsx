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
import { AufStartHelp, AufStartToggle } from './AufStartToggle';
import { cubeStatusKey } from './SmartCubePanel';
import { CubeConnection } from './SolveToolbar';
import { PRACTICE_MODE_OPTIONS, TrainerModeToggle } from './TrainerModeToggle';
import { ChoiceHelp, GearIcon, SettingRow, SettingsGroup, Switch } from './ui';

/** Random practice draws from the selected cases; case practice repeats one case. */
export type PracticeScope = 'random' | 'case';

// How a mode runs, in the mode's (i): with a cube connected, what the cube does.
function modeHelp(flavor: TrainerFlavor, scope: PracticeScope): MessageKey {
  if (flavor === 'no-scramble') return 'practice.cube.noSetup';
  if (flavor === 'smart-setup') return 'practice.cube.setup';
  if (flavor === 'inverse') return 'practice.mode.withSetupHelp';
  return scope === 'case' ? 'practice.mode.noSetupHelpCase' : 'practice.mode.noSetupHelp';
}

// How to practise, as setting rows like the top page's: the smart cube, the
// mode (with or without setup), the AUF, with a cube whether the next case
// comes by itself, and for random practice whether to take each selected
// case once. Kept as chosen (mode and AUF in the practice settings, the
// others on this device); a change takes effect with the next case (at once
// while a case waits).
function PracticeSettingsForm({ scope }: { scope: PracticeScope }) {
  const { t } = useT();
  const mounted = useMounted();
  const mode = usePracticeMode();
  const cube = useSmartCube();
  const connected = cube.status === 'connected';
  const flavor = trainerFlavor(mode, connected);
  const { autoAdvance } = useSmartCubeSettings();
  const { eachOnce, setEachOnce } = usePracticeOptions();
  const cubeAvailable = mounted && unsupportedReason() === null;
  const cubeName = cube.virtual ? t('smartCube.test.title') : cube.deviceName;
  return (
    <SettingsGroup>
      <SettingRow
        label={t('smartCube.title')}
        info={cubeAvailable && !connected ? t(mode === 'setup' ? 'practice.cube.offerSetup' : 'practice.cube.offerNoSetup') : undefined}
        detail={mounted ? (connected && cubeName ? cubeName : t(cubeStatusKey(cube))) : ' '}
      >
        {mounted && <CubeConnection />}
      </SettingRow>
      <SettingRow
        label={t('practice.mode.title')}
        info={<ChoiceHelp items={PRACTICE_MODE_OPTIONS.map((option) => ({
          label: t(option.label), text: t(modeHelp(trainerFlavor(option.value, connected), scope)),
        }))} />}
      >
        <TrainerModeToggle />
      </SettingRow>
      <SettingRow label={t('practice.auf.title')} info={<AufStartHelp />}>
        <AufStartToggle />
      </SettingRow>
      {isCubeFlavor(flavor) && (
        <SettingRow label={t('trainer.setup.autoAdvance')} info={t('trainer.setup.autoAdvanceHelp')}>
          {(labelId) => <Switch checked={autoAdvance} onChange={setAutoAdvance} labelledBy={labelId} />}
        </SettingRow>
      )}
      {scope === 'random' && (
        <SettingRow label={t('practice.round.label')} info={t('practice.round.help')}>
          {(labelId) => <Switch checked={mounted && eachOnce} onChange={setEachOnce} labelledBy={labelId} />}
        </SettingRow>
      )}
    </SettingsGroup>
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
