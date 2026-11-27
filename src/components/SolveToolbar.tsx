'use client';

import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { useSolveSettings } from '@/hooks/useSolveSettings';
import { useT } from '@/hooks/useT';
import { openAppDialog } from '@/lib/app-dialog';
import { isNativeApp } from '@/lib/native';
import { connect, connectLast, startScan, unsupportedReason } from '@/lib/smart-cube-store';
import { BatteryLevel } from './BatteryLevel';
import { PROBLEM, STATUS } from './SmartCubePanel';
import { SolveSettingsButton } from './SolveSettings';

export const ICON_BUTTON = 'inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  );
}

// The smart cube, small: connect it, or see it is connected and its
// battery. The smart cube dialog keeps the rest (holding, MAC, disconnect).
export function CubeConnection() {
  const { t } = useT();
  const cube = useSmartCube();
  const { lastCube } = useSmartCubeSettings();
  const chip = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium';
  // A connected cube shows even where Bluetooth cannot connect one (the test cube).
  if (cube.status === 'connected') {
    return (
      <button type="button" onClick={() => openAppDialog('smartCube')}
        className={`${chip} border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950`}>
        <CubeIcon />
        {cube.battery === null ? t('smartCube.status.connected') : <BatteryLevel level={cube.battery} />}
      </button>
    );
  }
  if (unsupportedReason() !== null) return null;
  const busy = ['choosing', 'scanning', 'reading-mac', 'connecting'].includes(cube.status);
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
    <button type="button" disabled={busy} onClick={onConnect} title={busy ? t(STATUS[cube.status]) : undefined}
      className={`${chip} border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40`}>
      <CubeIcon />
      {t(cube.status === 'needs-mac' ? 'practice.cube.enterMac' : busy ? 'smartCube.status.connecting' : 'practice.cube.connect')}
    </button>
  );
}

/** Why the smart cube is not connected, when something went wrong. */
export function CubeProblem() {
  const { t } = useT();
  const { problem, status } = useSmartCube();
  if (!problem || status === 'connected') return null;
  return <p role="alert" className="text-xs text-amber-800 dark:text-amber-200">{t(PROBLEM[problem])}</p>;
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
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <span className="mr-1"><CubeConnection /></span>
      <button type="button" onClick={onNewScramble} disabled={newDisabled} aria-label={t('solve.scramble.new')} title={t('solve.scramble.new')}
        className={ICON_BUTTON}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5">
          <path d="M20 11a8 8 0 0 0-14.7-4.4L4 8m0-4v4h4M4 13a8 8 0 0 0 14.7 4.4L20 16m0 4v-4h-4" />
        </svg>
      </button>
      <SolveSettingsButton settings={settings} disabled={false} className={ICON_BUTTON} />
    </div>
  );
}
