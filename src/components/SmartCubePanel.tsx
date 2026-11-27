'use client';

import { useEffect, useState } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { stateEquals, SOLVED } from '@/lib/smart-cube/cube-state';
import { CUBE_HOLDINGS, type CubeHolding } from '@/lib/smart-cube/holding';
import type { SmartCubeUnsupported } from '@/lib/smart-cube/support';
import { isNativeApp } from '@/lib/native';
import {
  connect,
  connectChosen,
  connectFound,
  connectLast,
  disconnect,
  hasChosenDevice,
  openBluetoothSettings,
  startScan,
  stopScan,
  unsupportedReason,
  type SmartCubeProblem,
  type SmartCubeSnapshot,
  type SmartCubeStatus,
} from '@/lib/smart-cube-store';
import { connectTestCube } from '@/lib/test-cube-store';
import { closeAppDialog } from '@/lib/app-dialog';
import { forgetMac, setHolding } from '@/lib/smart-cube-settings-store';
import { clearSmartSolves, MAX_SMART_SOLVES } from '@/lib/smart-solve-store';
import { useSmartSolveCount } from '@/hooks/useSmartSolves';
import { BatteryLevel } from './BatteryLevel';
import { MarkSolvedButton } from './MarkSolvedButton';
import { buttonClass, INPUT, LINK, Segmented, SettingRow, SettingsGroup } from './ui';

export const UNSUPPORTED: Record<SmartCubeUnsupported, MessageKey> = {
  ios: 'smartCube.unsupported.ios',
  insecure: 'smartCube.unsupported.insecure',
  firefox: 'smartCube.unsupported.firefox',
  safari: 'smartCube.unsupported.safari',
  browser: 'smartCube.unsupported.browser',
};
export const STATUS: Record<SmartCubeStatus, MessageKey> = {
  idle: 'smartCube.status.idle',
  choosing: 'smartCube.status.choosing',
  scanning: 'smartCube.status.scanning',
  'reading-mac': 'smartCube.status.readingMac',
  'needs-mac': 'smartCube.status.needsMac',
  connecting: 'smartCube.status.connecting',
  connected: 'smartCube.status.connected',
};
export const PROBLEM: Record<SmartCubeProblem, MessageKey> = {
  'not-gen4': 'smartCube.problem.notGen4',
  'invalid-mac': 'smartCube.problem.invalidMac',
  'wrong-mac': 'smartCube.problem.wrongMac',
  lost: 'smartCube.problem.lost',
  failed: 'smartCube.problem.failed',
  'none-found': 'smartCube.problem.noneFound',
  'bluetooth-off': 'smartCube.problem.bluetoothOff',
  'bluetooth-denied': 'smartCube.problem.bluetoothDenied',
};
const HOLDING_LABELS: Record<CubeHolding, MessageKey> = {
  'yellow-blue': 'smartCube.holding.yellowBlue',
  'yellow-green': 'smartCube.holding.yellowGreen',
  'white-green': 'smartCube.holding.whiteGreen',
};

/**
 * What the smart cube is doing, in a line: why it cannot connect here, what
 * went wrong, what it is waiting for, or that it is connected (with its name).
 * The same words under its setting and in the dialog.
 */
export function cubeStatusKey(cube: Pick<SmartCubeSnapshot, 'status' | 'problem'>): MessageKey {
  const unsupported = cube.status === 'connected' ? null : unsupportedReason();
  if (unsupported) return UNSUPPORTED[unsupported];
  if (cube.problem && cube.status !== 'connected') return PROBLEM[cube.problem];
  return STATUS[cube.status];
}

const HOLDINGS_HELP: MessageKey = 'smartCube.holding.help';

/** What the dialog says about the smart cube, behind the (i) by its title. */
export function SmartCubeInfo() {
  const { t } = useT();
  return (
    <>
      <span className="block">{t('smartCube.description')}</span>
      <span className="block">{t('smartCube.usage')}</span>
    </>
  );
}

// The smart cube dialog, as setting rows like the top page's: the cube
// (what it is doing, and connecting or disconnecting it; once connected its
// battery, state and "mark as solved"), the MAC address, how it is held, the
// solves it recorded, and the test cube. Explanations are behind each (i).
export function SmartCubePanel() {
  const { t, tn } = useT();
  const mounted = useMounted();
  const solveCount = useSmartSolveCount();
  const cube = useSmartCube();
  const { holding, macs, lastCube } = useSmartCubeSettings();
  const [mac, setMac] = useState('');
  const [forgot, setForgot] = useState(false);
  // The app scans while this panel is open; closing it ends the scan.
  useEffect(() => () => { void stopScan(); }, []);
  if (!mounted) return null;

  const unsupported = unsupportedReason();
  // The iOS app has no browser dialog to choose a cube in: it scans and lists them.
  const native = isNativeApp();
  const scanning = cube.status === 'scanning';
  const busy = cube.status === 'choosing' || scanning || cube.status === 'reading-mac' || cube.status === 'connecting';
  const connected = cube.status === 'connected';
  const askMac = cube.status === 'needs-mac';
  // The test cube works where Bluetooth does not, so its part shows there too.
  const testCube = cube.virtual && (connected || cube.status === 'connecting');
  // The app offers the last cube by name instead (connectLast).
  const canReconnect = !native && cube.status === 'idle' && hasChosenDevice();
  const state = cube.state === null
    ? t('smartCube.state.unknown')
    : t(stateEquals(cube.state, SOLVED) ? 'smartCube.state.solved' : 'smartCube.state.unsolved');
  const name = cube.virtual ? t('smartCube.test.title') : cube.deviceName;
  const model = connected && cube.model && !cube.virtual ? ` (${cube.model}${cube.firmware ? ` ${cube.firmware}` : ''})` : '';
  const sm = (variant: Parameters<typeof buttonClass>[0]) => buttonClass(variant, 'sm');

  return (
    <div className="space-y-3 text-sm">
      {(!unsupported || testCube) ? (
        <SettingsGroup>
          <SettingRow
            label={name ? `${name}${model}` : t('smartCube.device')}
            detail={(
              <span aria-live="polite" className={cube.problem && !connected ? 'text-amber-800 dark:text-amber-200' : ''}>
                {t(cubeStatusKey(cube))}
                {cube.problem === 'bluetooth-denied' && !connected && (
                  <>{' '}<button type="button" className={LINK} onClick={() => void openBluetoothSettings()}>{t('smartCube.openSettings')}</button></>
                )}
              </span>
            )}
          >
            <div className="flex flex-wrap gap-2">
              {connected && <button type="button" className={sm('secondary')} onClick={disconnect}>{t('smartCube.disconnect')}</button>}
              {/* A real cube can be connected in place of the test cube. */}
              {unsupported || (connected && !cube.virtual) ? null : native ? (
                <>
                  {lastCube && (
                    <button type="button" className={sm('primary')} disabled={busy} onClick={() => void connectLast(mac)}>
                      {t('smartCube.connectLast', { name: lastCube.name })}
                    </button>
                  )}
                  {scanning ? (
                    <button type="button" className={sm('secondary')} onClick={() => void stopScan()}>{t('smartCube.stopScan')}</button>
                  ) : (
                    <button type="button" className={sm(lastCube ? 'secondary' : 'primary')} disabled={busy} onClick={() => void startScan()}>
                      {t('smartCube.scan')}
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className={sm('primary')} disabled={busy} onClick={() => void connect(mac)}>{t('smartCube.connect')}</button>
              )}
              {canReconnect && (
                <button type="button" className={sm('secondary')} onClick={() => void connectChosen()}>{t('smartCube.reconnect')}</button>
              )}
            </div>
          </SettingRow>
          {native && !connected && cube.found.length > 0 && (
            <ul aria-label={t('smartCube.found')} className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {cube.found.map((found) => (
                <li key={found.deviceId}>
                  <SettingRow label={found.name}>
                    <button type="button" className={sm('secondary')} disabled={cube.status === 'connecting'}
                      onClick={() => void connectFound(found.deviceId, mac)}>
                      {t('smartCube.connectFound')}
                    </button>
                  </SettingRow>
                </li>
              ))}
            </ul>
          )}
          {/* Kept while not connected (showing "-"), so connecting adds no rows. */}
          <SettingRow label={t('smartCube.battery')}>
            <span className="text-sm">{!connected || cube.battery === null ? '-' : <BatteryLevel level={cube.battery} labelled />}</span>
          </SettingRow>
          <SettingRow label={t('smartCube.state')} info={t('smartCube.markSolved.help')}>
            <span className="flex items-center gap-3">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{connected ? state : '-'}</span>
              <MarkSolvedButton variant="button" />
            </span>
          </SettingRow>
        </SettingsGroup>
      ) : (
        <SettingsGroup>
          <SettingRow label={t('smartCube.device')} detail={t(UNSUPPORTED[unsupported])} />
        </SettingsGroup>
      )}

      {(!unsupported || testCube) && (
        <SettingsGroup>
          {!unsupported && (
            <SettingRow label={t('smartCube.mac.label')} stacked info={(
              <>
                <span className="block">{t(native ? 'smartCube.mac.helpNative' : 'smartCube.mac.help')}</span>
                <span className="block">{t('smartCube.mac.howTo')}</span>
              </>
            )}>
              {(labelId) => (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={mac} onChange={(event) => setMac(event.target.value)} aria-labelledby={labelId}
                      placeholder="AB:12:CD:34:EF:56" spellCheck={false} autoCapitalize="characters"
                      className={`${INPUT} font-mono`} />
                    {askMac && (
                      <button type="button" className={buttonClass('primary')} onClick={() => void connectChosen(mac)}>{t('practice.cube.connectShort')}</button>
                    )}
                  </div>
                  {Object.keys(macs).length > 0 && (
                    <button type="button" className={`${LINK} text-xs`} onClick={() => { forgetMac(); setForgot(true); }}>
                      {t('smartCube.forgetMacs')}
                    </button>
                  )}
                  {forgot && Object.keys(macs).length === 0 && <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">{t('smartCube.forgotMacs')}</p>}
                </div>
              )}
            </SettingRow>
          )}
          <SettingRow label={t('smartCube.holding.title')} info={t(HOLDINGS_HELP)} stacked>
            <Segmented label={t('smartCube.holding.aria')} value={holding} onChange={setHolding} vertical
              options={CUBE_HOLDINGS.map((value) => ({ value, label: t(HOLDING_LABELS[value]) }))} />
          </SettingRow>
        </SettingsGroup>
      )}

      <SettingsGroup>
        {(!unsupported || (solveCount ?? 0) > 0) && (
          <SettingRow label={t('smartCube.records.title')} info={t('smartCube.records.help', { max: MAX_SMART_SOLVES })}
            detail={solveCount === null ? '-' : tn('smartCube.records.count', solveCount)}>
            {(solveCount ?? 0) > 0 && (
              <button type="button" className={sm('danger')}
                onClick={() => { if (window.confirm(t('smartCube.records.confirmClear'))) void clearSmartSolves(); }}>
                {t('smartCube.records.clear')}
              </button>
            )}
          </SettingRow>
        )}
        {/* Closes the dialog, so the test cube's panel can be used at once. */}
        {!testCube && (
          <SettingRow label={t('smartCube.test.title')} info={t('smartCube.test.help')}>
            <button type="button" className={sm('secondary')} onClick={() => { void connectTestCube(); closeAppDialog(); }}>
              {t('practice.cube.connectShort')}
            </button>
          </SettingRow>
        )}
      </SettingsGroup>
    </div>
  );
}
