'use client';

import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { useSolveSettings } from '@/hooks/useSolveSettings';
import { useT } from '@/hooks/useT';
import { openAppDialog } from '@/lib/app-dialog';
import { isNativeApp } from '@/lib/native';
import { connect, connectLast, startScan, unsupportedReason } from '@/lib/smart-cube-store';
import { BatteryLevel } from './BatteryLevel';
import { cubeStatusKey } from './SmartCubePanel';
import { SolveSettingsButton } from './SolveSettings';
import { buttonClass, CubeIcon, Icon, iconButtonClass } from './ui';

export const CUBE_ICON = <CubeIcon className="size-3.5" />;

const BUSY = ['choosing', 'scanning', 'reading-mac', 'connecting'];

// The smart cube, small, the same on a scramble's or a case's toolbar and
// under the practice's settings: a button to connect it, or once connected
// its battery, which opens the smart cube dialog (holding, MAC, disconnect).
// One size in every state, so connecting moves nothing around it.
export function CubeConnection() {
  const { t } = useT();
  const cube = useSmartCube();
  const { lastCube } = useSmartCubeSettings();
  const chip = buttonClass('secondary', 'sm');
  // A connected cube shows even where Bluetooth cannot connect one (the test cube).
  if (cube.status === 'connected') {
    const name = cube.virtual ? t('smartCube.test.title') : cube.deviceName ?? t('smartCube.title');
    return (
      <button type="button" onClick={() => openAppDialog('smartCube')} title={name} aria-label={`${name}, ${t('smartCube.status.connected')}`} className={chip}>
        <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
        {cube.battery === null ? t('smartCube.status.connected') : <BatteryLevel level={cube.battery} />}
      </button>
    );
  }
  if (unsupportedReason() !== null) return null;
  const busy = BUSY.includes(cube.status);
  const onConnect = () => {
    if (cube.status === 'needs-mac') {
      openAppDialog('smartCube');
    } else if (isNativeApp()) {
      // The app has no system chooser: the dialog lists the cubes it finds.
      openAppDialog('smartCube');
      void (lastCube ? connectLast() : startScan());
    } else {
      // Opens the browser's chooser, so it has to run in the click.
      void connect();
    }
  };
  return (
    <button data-ui="CubeConnection" type="button" disabled={busy} onClick={onConnect} title={t(cubeStatusKey(cube))} className={chip}>
      {CUBE_ICON}
      {t(cube.status === 'needs-mac' ? 'practice.cube.enterMac' : busy ? 'smartCube.status.connecting' : 'practice.cube.connectShort')}
    </button>
  );
}

// The scramble screen's controls, for any kind of solve: the smart cube
// (connect, or its battery), a new scramble and the solve's settings.
export function SolveToolbar({ settings, onNewScramble, newDisabled }: {
  settings: ReturnType<typeof useSolveSettings>;
  onNewScramble: () => void;
  newDisabled: boolean;
}) {
  const { t } = useT();
  return (
    <div data-ui="SolveToolbar" className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <span className="mr-1"><CubeConnection /></span>
      <button type="button" onClick={onNewScramble} disabled={newDisabled} aria-label={t('solve.scramble.new')} title={t('solve.scramble.new')}
        className={iconButtonClass()}>
        <Icon><path d="M20 11a8 8 0 0 0-14.7-4.4L4 8m0-4v4h4M4 13a8 8 0 0 0 14.7 4.4L20 16m0 4v-4h-4" /></Icon>
      </button>
      <SolveSettingsButton settings={settings} disabled={false} className={iconButtonClass()} />
    </div>
  );
}
