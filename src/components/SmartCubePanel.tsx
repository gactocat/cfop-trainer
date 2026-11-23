'use client';

import { useState, type ReactNode } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { stateEquals, SOLVED } from '@/lib/smart-cube/cube-state';
import { CUBE_HOLDINGS, type CubeHolding } from '@/lib/smart-cube/holding';
import type { SmartCubeUnsupported } from '@/lib/smart-cube/support';
import { connect, connectChosen, disconnect, hasChosenDevice, unsupportedReason, type SmartCubeProblem, type SmartCubeStatus } from '@/lib/smart-cube-store';
import { forgetMac, setHolding } from '@/lib/smart-cube-settings-store';
import { clearSmartSolves, MAX_SMART_SOLVES } from '@/lib/smart-solve-store';
import { useSmartSolveCount } from '@/hooks/useSmartSolves';

const UNSUPPORTED: Record<SmartCubeUnsupported, MessageKey> = {
  'native-app': 'smartCube.unsupported.nativeApp',
  ios: 'smartCube.unsupported.ios',
  insecure: 'smartCube.unsupported.insecure',
  firefox: 'smartCube.unsupported.firefox',
  safari: 'smartCube.unsupported.safari',
  browser: 'smartCube.unsupported.browser',
};
const STATUS: Record<SmartCubeStatus, MessageKey> = {
  idle: 'smartCube.status.idle',
  choosing: 'smartCube.status.choosing',
  'reading-mac': 'smartCube.status.readingMac',
  'needs-mac': 'smartCube.status.needsMac',
  connecting: 'smartCube.status.connecting',
  connected: 'smartCube.status.connected',
};
const PROBLEM: Record<SmartCubeProblem, MessageKey> = {
  'not-gen4': 'smartCube.problem.notGen4',
  'invalid-mac': 'smartCube.problem.invalidMac',
  'wrong-mac': 'smartCube.problem.wrongMac',
  lost: 'smartCube.problem.lost',
  failed: 'smartCube.problem.failed',
};
const HOLDING_LABELS: Record<CubeHolding, MessageKey> = {
  'yellow-blue': 'smartCube.holding.yellowBlue',
  'yellow-green': 'smartCube.holding.yellowGreen',
  'white-green': 'smartCube.holding.whiteGreen',
};

const button = 'rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';
const primary = 'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function SmartCubePanel() {
  const { t, tn } = useT();
  const mounted = useMounted();
  const solveCount = useSmartSolveCount();
  const cube = useSmartCube();
  const { holding, macs } = useSmartCubeSettings();
  const [mac, setMac] = useState('');
  const [forgot, setForgot] = useState(false);
  if (!mounted) return null;

  const unsupported = unsupportedReason();
  const busy = cube.status === 'choosing' || cube.status === 'reading-mac' || cube.status === 'connecting';
  const connected = cube.status === 'connected';
  const askMac = cube.status === 'needs-mac';
  const canReconnect = cube.status === 'idle' && hasChosenDevice();
  const state = cube.state === null
    ? t('smartCube.state.unknown')
    : t(stateEquals(cube.state, SOLVED) ? 'smartCube.state.solved' : 'smartCube.state.unsolved');

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1 text-zinc-600 dark:text-zinc-300">
        <p>{t('smartCube.description')}</p>
        <p>{t('smartCube.usage')}</p>
      </div>

      {unsupported ? (
        <p role="note" className="rounded-md bg-zinc-100 px-3 py-2 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {t(UNSUPPORTED[unsupported])}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {connected ? (
                <button type="button" className={button} onClick={disconnect}>{t('smartCube.disconnect')}</button>
              ) : (
                <button type="button" className={primary} disabled={busy} onClick={() => void connect(mac)}>{t('smartCube.connect')}</button>
              )}
              {canReconnect && (
                <button type="button" className={button} onClick={() => void connectChosen()}>{t('smartCube.reconnect')}</button>
              )}
            </div>
            <div aria-live="polite" className="space-y-1">
              <Row label={t('smartCube.device')}>
                {cube.deviceName ?? '-'}
                {connected && cube.model ? ` (${cube.model}${cube.firmware ? ` ${cube.firmware}` : ''})` : ''}
              </Row>
              <p className="text-zinc-700 dark:text-zinc-200">{t(STATUS[cube.status])}</p>
              {cube.problem && (
                <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {t(PROBLEM[cube.problem])}
                </p>
              )}
              {connected && <>
                <Row label={t('smartCube.battery')}>{cube.battery === null ? '-' : `${cube.battery}%`}</Row>
                <Row label={t('smartCube.state')}>{state}</Row>
              </>}
            </div>
          </div>

          <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <label className="block space-y-1">
              <span className="font-medium">{t('smartCube.mac.label')}</span>
              <input
                value={mac}
                onChange={(event) => setMac(event.target.value)}
                placeholder="AB:12:CD:34:EF:56"
                spellCheck={false}
                autoCapitalize="characters"
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            {askMac && (
              <button type="button" className={primary} onClick={() => void connectChosen(mac)}>{t('smartCube.continue')}</button>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('smartCube.mac.help')}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('smartCube.mac.howTo')}</p>
            {Object.keys(macs).length > 0 && (
              <button type="button" className="text-xs underline" onClick={() => { forgetMac(); setForgot(true); }}>
                {t('smartCube.forgetMacs')}
              </button>
            )}
            {forgot && Object.keys(macs).length === 0 && <p className="text-xs">{t('smartCube.forgotMacs')}</p>}
          </div>

          <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <h3 className="font-medium">{t('smartCube.holding.title')}</h3>
            <div role="radiogroup" aria-label={t('smartCube.holding.aria')} className="flex flex-col gap-1">
              {CUBE_HOLDINGS.map((value) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="smart-cube-holding" checked={holding === value} onChange={() => setHolding(value)} />
                  {t(HOLDING_LABELS[value])}
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('smartCube.holding.help')}</p>
          </div>
        </>
      )}

      {(!unsupported || (solveCount ?? 0) > 0) && (
        <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <h3 className="font-medium">{t('smartCube.records.title')}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('smartCube.records.help', { max: MAX_SMART_SOLVES })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>{solveCount === null ? '-' : tn('smartCube.records.count', solveCount)}</span>
            {(solveCount ?? 0) > 0 && (
              <button
                type="button"
                className={button}
                onClick={() => { if (window.confirm(t('smartCube.records.confirmClear'))) void clearSmartSolves(); }}
              >
                {t('smartCube.records.clear')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
