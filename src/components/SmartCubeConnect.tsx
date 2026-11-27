'use client';

import { useMounted } from '@/hooks/useMounted';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import { openAppDialog } from '@/lib/app-dialog';
import { isNativeApp } from '@/lib/native';
import { connect, connectLast, disconnect, startScan, unsupportedReason } from '@/lib/smart-cube-store';
import { BatteryLevel } from './BatteryLevel';
import { PROBLEM, STATUS, UNSUPPORTED } from './SmartCubePanel';

function CubeIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  );
}

// The smart cube in the practice options: a button to connect one, then the
// cube's name and battery. The smart cube dialog keeps the rest (MAC
// address, holding, marking the cube solved, the iOS app's list of cubes
// found), and this opens it when a step needs it. Where Bluetooth is unavailable it says why instead.
export function SmartCubeConnect() {
  const { t } = useT();
  const mounted = useMounted();
  const cube = useSmartCube();
  const { lastCube } = useSmartCubeSettings();
  if (!mounted) return null;

  if (cube.status === 'connected') {
    return (
      <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="truncate font-medium text-emerald-900 dark:text-emerald-100">{cube.virtual ? t('smartCube.test.title') : cube.deviceName ?? t('smartCube.title')}</span>
          <span className="shrink-0 text-xs text-emerald-800/80 dark:text-emerald-200/80">
            {cube.battery === null ? t('smartCube.status.connected') : <BatteryLevel level={cube.battery} />}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-x-3 text-xs text-emerald-800 dark:text-emerald-200">
          <button type="button" onClick={() => openAppDialog('smartCube')} className="text-emerald-800 underline hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white">
            {t('practice.cube.settings')}
          </button>
          <button type="button" onClick={disconnect} className="text-emerald-800 underline hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white">
            {t('smartCube.disconnect')}
          </button>
        </span>
      </div>
    );
  }

  // Checked after the connected cube: the test cube connects where Bluetooth cannot.
  const unsupported = unsupportedReason();
  if (unsupported) {
    return (
      <p role="note" className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
        {t(UNSUPPORTED[unsupported])}
      </p>
    );
  }

  const native = isNativeApp();
  const busy = cube.status === 'choosing' || cube.status === 'scanning' || cube.status === 'reading-mac' || cube.status === 'connecting';
  const onConnect = () => {
    if (native) {
      // The app has no system chooser: the dialog lists the cubes it finds,
      // or connects the last one again.
      openAppDialog('smartCube');
      void (lastCube ? connectLast() : startScan());
      return;
    }
    // Opens the browser's chooser, so it has to run in the click.
    void connect();
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={onConnect}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
      >
        <CubeIcon />
        {t('practice.cube.connectShort')}
      </button>
      <div aria-live="polite" className="space-y-1 text-xs">
        {(busy || cube.status === 'needs-mac') && (
          <p className="text-zinc-600 dark:text-zinc-300">{t(STATUS[cube.status])}</p>
        )}
        {cube.status === 'needs-mac' && (
          <button type="button" onClick={() => openAppDialog('smartCube')} className="font-medium text-emerald-700 underline dark:text-emerald-300">
            {t('practice.cube.enterMac')}
          </button>
        )}
        {cube.problem && (
          <p role="alert" className="text-amber-800 dark:text-amber-200">{t(PROBLEM[cube.problem])}</p>
        )}
      </div>
    </div>
  );
}
