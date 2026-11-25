'use client';

import { Fragment, memo, useCallback, useEffect, useRef, useState } from 'react';
import { useCubeSolve, type CubeSolveScreen } from '@/hooks/useCubeSolve';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useHoldTimer } from '@/hooks/useHoldTimer';
import { useMounted } from '@/hooks/useMounted';
import { useKeepAwake, useNativeTimer } from '@/hooks/useNativeTimer';
import { useScramble } from '@/hooks/useScramble';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useSolveSettings } from '@/hooks/useSolveSettings';
import { useSolves } from '@/hooks/useSolves';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useT } from '@/hooks/useT';
import { openAppDialog } from '@/lib/app-dialog';
import type { HoldPhase } from '@/lib/hold-timer';
import { isNativeApp } from '@/lib/native';
import { connect, connectLast, startScan, unsupportedReason } from '@/lib/smart-cube-store';
import { deleteSolve, saveSolve } from '@/lib/solve-store';
import { solveTps } from '@/lib/solve/cfop-split';
import { inspectionCall, inspectionPenalty, inspectionShown } from '@/lib/solve/inspection';
import { handSolve, type Penalty, type SolveRecord } from '@/lib/solve/solve-record';
import { formatRecordTime, formatSolveTime } from '@/lib/solve/solve-stats';
import { setTimerFocus } from '@/lib/timer-focus';
import { ScrambleNet } from './ScrambleNet';
import { PenaltyButtons, RecordTime } from './SolvePenalty';
import { SolveRecords, TimerBadge } from './SolveRecords';
import { SolveSettingsPanel } from './SolveSettingsPanel';
import { SolveStages } from './SolveStages';
import { PROBLEM, STATUS } from './SmartCubePanel';

const CARD = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const LABEL = 'text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';

// The timer's digits: red while held, green while running (as the practice timer).
const DIGITS: Record<HoldPhase, string> = {
  idle: 'text-zinc-900 dark:text-zinc-50',
  pressed: 'text-rose-600 dark:text-rose-400',
  armed: 'text-rose-600 dark:text-rose-400',
  running: 'text-emerald-600 dark:text-emerald-400',
  stopped: 'text-zinc-900 dark:text-zinc-50',
};

function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M12 2 21 7v10l-9 5-9-5V7z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  );
}

// The smart cube, small, beside the scramble: connect it, or see it is
// connected. The smart cube dialog keeps the rest (holding, MAC, disconnect).
function CubeConnection() {
  const { t } = useT();
  const cube = useSmartCube();
  const { lastCube } = useSmartCubeSettings();
  if (unsupportedReason() !== null) return null;
  const chip = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium';
  if (cube.status === 'connected') {
    return (
      <button type="button" onClick={() => openAppDialog('smartCube')}
        className={`${chip} border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950`}>
        <CubeIcon />
        <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
        {cube.battery === null ? t('smartCube.status.connected') : t('practice.cube.battery', { level: cube.battery })}
      </button>
    );
  }
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

function CubeProblem() {
  const { t } = useT();
  const { problem, status } = useSmartCube();
  if (!problem || status === 'connected') return null;
  return <p role="alert" className="mt-2 text-xs text-amber-800 dark:text-amber-200">{t(PROBLEM[problem])}</p>;
}

/** The scramble's tokens, those already turned dimmed and the next underlined. */
function Tokens({ tokens, done }: { tokens: readonly string[]; done: number | null }) {
  return (
    <>
      {tokens.map((token, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className={done === null ? '' : i < done ? 'opacity-35' : i === done ? 'underline decoration-2 underline-offset-8' : ''}>{token}</span>
        </Fragment>
      ))}
    </>
  );
}

/** What the smart cube needs next, under the scramble. */
function CubeStatus({ screen, synced }: { screen: CubeSolveScreen | null; synced: boolean }) {
  const { t } = useT();
  const chip = 'inline-block rounded-md px-3 py-1.5 text-sm font-semibold';
  if (!synced || !screen) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('solve.cube.syncing')}</p>;
  if (screen.phase === 'ready') return <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t('smartCube.trainer.ready')}</p>;
  if (screen.routeFailed) return <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">{t('solve.cube.routeFailed')}</p>;
  if (screen.routeKind === null) return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('solve.cube.routing')}</p>;
  if (screen.undo) return <p aria-live="polite" className={`${chip} bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200`}>{t('smartCube.trainer.undo', { moves: screen.undo })}</p>;
  if (screen.remaining) return <p aria-live="polite" className={`${chip} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>{t('smartCube.trainer.remaining', { moves: screen.remaining })}</p>;
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(screen.routeKind === 'reroute' ? 'solve.cube.reroute' : 'solve.cube.turn')}</p>;
}

/** What the timer shows: a time counting up, the inspection counting down, or a fixed text. */
type Shown = { kind: 'running'; since: number } | { kind: 'inspection'; since: number } | { kind: 'still'; text: string };

/** Redraws every frame while `on`; returns performance.now(). */
function useNow(on: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on]);
  return now;
}

// The timer's digits. During the inspection: the whole seconds left, then
// +2 and DNF, with the 8 and 12 second calls below in small type.
function TimerDisplay({ shown, className }: { shown: Shown; className: string }) {
  const { t } = useT();
  const now = useNow(shown.kind !== 'still');
  const digits = 'font-mono text-7xl font-bold tabular-nums leading-none transition-colors sm:text-8xl';
  if (shown.kind === 'still') return <div className={`${digits} ${className}`} aria-live="off">{shown.text}</div>;
  const ms = Math.max(0, now - shown.since);
  if (shown.kind === 'running') return <div className={`${digits} ${className}`} aria-live="off">{formatSolveTime(ms)}</div>;
  const left = inspectionShown(ms);
  const call = inspectionCall(ms);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${digits} ${className}`} aria-live="off">
        {'seconds' in left ? left.seconds : left.penalty === 'plus2' ? '+2' : 'DNF'}
      </div>
      <div className="h-5 text-sm font-medium text-amber-700 dark:text-amber-300" aria-live="polite">
        {call !== null && t('solve.inspection.call', { seconds: call })}
      </div>
    </div>
  );
}

function Figure({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className={LABEL}>{label}</dt>
      <dd className={`font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 ${big ? 'text-3xl' : 'text-xl'}`}>{value}</dd>
    </div>
  );
}

// The solve just finished: time (with its penalty), moves and TPS, the
// penalty buttons, and for a cube solve its stages.
function LatestSolve({ record, onUndo, className }: { record: SolveRecord; onUndo: () => void; className: string }) {
  const { t } = useT();
  const connected = useSmartCube().status === 'connected';
  const cube = record.moveCount !== undefined;
  const tps = cube ? solveTps(record.moveCount!, record.ms) : null;
  return (
    <section aria-labelledby="latest-solve" className={`${CARD} p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="latest-solve" className="flex items-center gap-2">
          <span className={LABEL}>{t('solve.result.title')}</span>
          <TimerBadge record={record} />
        </h2>
        <span className="flex items-center gap-2">
          <PenaltyButtons record={record} />
          <button type="button" onClick={onUndo}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {t('solve.result.undo')}
          </button>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 items-start gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <dt className={LABEL}>{t('solve.time')}</dt>
          <dd><RecordTime record={record} className="font-mono text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50" /></dd>
        </div>
        <Figure label={t('solve.moves')} value={cube ? String(record.moveCount) : '-'} />
        <Figure label="TPS" value={tps === null ? '-' : tps.toFixed(2)} />
      </dl>
      {record.inspectionMs !== undefined && (
        <p className="mt-2 text-center font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {t('solve.result.inspection', { seconds: (record.inspectionMs / 1000).toFixed(2) })}
        </p>
      )}
      {!cube && <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">{t(connected ? 'solve.result.byHand' : 'solve.result.noCube')}</p>}
      <SolveStages record={record} className="mt-4" />
    </section>
  );
}

const MemoRecords = memo(SolveRecords);

// A CFOP solve from a random-state scramble, held as set for CFOP (top and
// front colours). Without a smart cube: with inspection, a tap starts it;
// then hold the timer to get ready, let go to start, press anywhere to stop.
// With one: the scramble is guided turn by turn, the cube in the scrambled
// state starts the inspection, its first turn starts the timer and solving
// stops it, and the solve is split into its stages. Starting after 15 s of
// inspection adds +2, after 17 s DNF; either can be changed afterwards.
// Solves are kept on the device, or in the account when signed in.
export function CfopSolve() {
  const { t } = useT();
  const mounted = useMounted();
  const settings = useSolveSettings('cfop');
  const inspectionOn = mounted && settings.inspection;
  const cube = useSmartCube();
  const connected = mounted && cube.status === 'connected';
  const { scramble, failed, next } = useScramble();
  const solves = useSolves('cfop');
  // The inspection before a solve without the cube (performance.now() it began).
  const [inspecting, setInspecting] = useState<number | null>(null);
  // The attempt being timed, by the on-screen timer or by the cube.
  const [timer, setTimer] = useState<{
    by: 'hand' | 'cube';
    since: number;
    scramble: string;
    penalty?: Penalty;
    inspectionMs?: number;
  } | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const latest = latestId === null ? null : solves.solves.find((s) => s.id === latestId) ?? null;

  // When the last solve stopped: the press that stopped it must not start the next inspection.
  const stoppedAt = useRef(-Infinity);
  const record = useCallback((solve: SolveRecord) => {
    stoppedAt.current = performance.now();
    // Shown at once; kept for this visit only when it cannot be stored.
    saveSolve(solve).catch(() => {});
    setLatestId(solve.id);
    setTimer(null);
    next();
  }, [next]);

  // The inspection's outcome when the solve starts: its length and any penalty.
  const fromInspection = (ms: number | null) => (ms === null || !inspectionOn ? {} : {
    inspectionMs: ms,
    ...(inspectionPenalty(ms) ? { penalty: inspectionPenalty(ms)! } : {}),
  });
  const begin = (by: 'hand' | 'cube', inspectionMs: number | null) => {
    if (!scramble) return;
    setInspecting(null);
    setTimer({ by, since: performance.now(), scramble, ...fromInspection(inspectionMs) });
  };
  // Stopped on screen: a cube solve stopped this way is timed on screen too.
  const stopByHand = () => {
    if (timer) record(handSolve(timer.scramble, performance.now() - timer.since, { penalty: timer.penalty, inspectionMs: timer.inspectionMs }));
  };

  // With a smart cube: guided scramble, then the cube starts and stops.
  const byCube = connected && timer?.by !== 'hand' && inspecting === null;
  const cubeSolve = useCubeSolve({
    active: byCube,
    scramble,
    holding: settings,
    onStart: (inspectionMs) => begin('cube', inspectionMs),
    onStop: (solve) => record({ ...solve, ...(timer?.penalty ? { penalty: timer.penalty } : {}), ...(timer?.inspectionMs !== undefined ? { inspectionMs: Math.round(timer.inspectionMs) } : {}) }),
  });
  const abortCube = () => {
    setTimer(null);
    cubeSolve.restart();
  };
  const screen = cubeSolve.screen;
  const cubeInspecting = byCube && inspectionOn && screen?.phase === 'ready' && screen.readySince !== null;

  // Without one: a tap starts the inspection (when on); then hold, let go, press to stop.
  const tapToInspect = mounted && !byCube && inspectionOn && inspecting === null && timer === null && scramble !== null;
  const startInspection = useCallback(() => {
    const now = performance.now();
    if (now - stoppedAt.current > 500) setInspecting(now);
  }, []);
  const hold = useHoldTimer({
    active: mounted && scramble !== null && !byCube && !tapToInspect,
    state: timer?.by === 'hand' ? 'running' : 'idle',
    pressOnNext: false,
    onStart: () => begin('hand', inspecting === null ? null : performance.now() - inspecting),
    onStop: stopByHand,
    onAbort: () => setTimer(null),
    onNext: () => {},
  });
  useSpacebar(startInspection, tapToInspect);

  const cubeRunning = timer?.by === 'cube';
  // While inspecting, held or timing, everything but the timer steps aside
  // (after the hold timer's own effect, so this one has the last word).
  const focus = inspecting !== null || cubeInspecting || hold.phase === 'armed' || hold.phase === 'running' || cubeRunning;
  useEffect(() => { setTimerFocus(focus); }, [focus, hold.phase]);
  useEffect(() => () => setTimerFocus(false), []);

  // Stable handlers for the key and app listeners, reading this render's state.
  const latestHandlers = useRef({ stopByHand, abortCube, abandon: () => {} });
  useEffect(() => {
    latestHandlers.current = {
      stopByHand,
      abortCube,
      abandon: cubeRunning ? abortCube : () => { setTimer(null); setInspecting(null); },
    };
  });
  const onSpace = useCallback(() => latestHandlers.current.stopByHand(), []);
  const onEscape = useCallback(() => latestHandlers.current.abortCube(), []);
  const onLeave = useCallback(() => latestHandlers.current.abandon(), []);
  const cancelInspection = useCallback(() => setInspecting(null), []);
  // Space stops a cube solve by hand; Escape abandons it, or the inspection.
  useSpacebar(onSpace, cubeRunning);
  useEscapeKey(onEscape, cubeRunning);
  useEscapeKey(cancelInspection, inspecting !== null && hold.phase === 'idle');
  // Leaving the iOS app abandons the attempt; a connected cube keeps the screen on.
  useNativeTimer(timer !== null || inspecting !== null, onLeave);
  useKeepAwake(connected);
  const onUndo = useCallback(() => {
    if (latestId) void deleteSolve('cfop', latestId).catch(() => {});
    setLatestId(null);
  }, [latestId]);
  const onDelete = useCallback((id: string) => {
    void deleteSolve('cfop', id).catch(() => {});
    setLatestId((current) => (current === id ? null : current));
  }, []);

  const aside = focus ? 'invisible' : '';
  const phase: HoldPhase = byCube ? (cubeRunning ? 'running' : 'idle') : hold.phase;
  const shown: Shown = timer ? { kind: 'running', since: timer.since }
    : inspecting !== null ? { kind: 'inspection', since: inspecting }
      : cubeInspecting ? { kind: 'inspection', since: screen!.readySince! }
        : { kind: 'still', text: hold.phase === 'pressed' || hold.phase === 'armed' || !latest ? formatSolveTime(0) : formatRecordTime(latest) };

  const rerouted = byCube && screen?.routeKind === 'reroute';
  const tokens = rerouted ? screen!.tokens : scramble?.split(' ') ?? [];
  const done = !byCube || !screen ? null : screen.phase === 'ready' ? tokens.length : screen.routeKind === null ? null : screen.doneTokens;
  const pressDown = byCube ? (cubeRunning ? stopByHand : undefined)
    : tapToInspect ? (event: { preventDefault: () => void }) => { event.preventDefault(); startInspection(); }
      : hold.pressProps.onPointerDown;
  const hint = byCube ? t(screen?.phase === 'ready' ? 'smartCube.trainer.ready' : 'solve.cube.hint')
    : t(tapToInspect ? 'solve.inspection.start' : 'trainer.hold.start');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="scramble-heading" className={`${CARD} p-4 sm:p-6 ${aside}`}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="scramble-heading" className={`${LABEL} min-w-0 pt-2`}>{t(rerouted ? 'solve.cube.routeTitle' : 'solve.scramble')}</h2>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {mounted && <CubeConnection />}
              <button type="button" onClick={next} disabled={!scramble || timer !== null} aria-label={t('solve.scramble.new')} title={t('solve.scramble.new')}
                className="inline-flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4.5">
                  <path d="M20 11a8 8 0 0 0-14.7-4.4L4 8m0-4v4h4M4 13a8 8 0 0 0 14.7 4.4L20 16m0 4v-4h-4" />
                </svg>
              </button>
            </div>
          </div>
          {mounted && <CubeProblem />}
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <p aria-live="polite" className="min-h-[2.5em] w-full font-mono text-2xl font-semibold leading-relaxed tracking-wide break-words text-zinc-900 sm:text-3xl dark:text-zinc-50">
                {scramble ? <Tokens tokens={tokens} done={done} /> : (
                  <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">{t(failed ? 'solve.scramble.failed' : 'solve.scramble.making')}</span>
                )}
              </p>
              {rerouted && scramble && (
                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{t('solve.cube.scrambleWas', { scramble })}</p>
              )}
              {byCube && scramble && <CubeStatus screen={screen} synced={cube.state !== null} />}
              {mounted && <SolveSettingsPanel settings={settings} disabled={timer !== null || inspecting !== null} />}
            </div>
            {scramble && <ScrambleNet scramble={scramble} frame={settings.frame} className="w-32 shrink-0 sm:mt-2 sm:w-40" />}
          </div>
        </section>

        <div
          onPointerDown={pressDown}
          onContextMenu={hold.pressProps.onContextMenu}
          role="button"
          tabIndex={-1}
          aria-label={cubeRunning || hold.phase === 'running' ? t('trainer.tapToStopAria')
            : inspecting !== null ? t('solve.inspection.aria')
              : byCube ? t('solve.cube.timerAria') : t(tapToInspect ? 'solve.inspection.start' : 'trainer.hold.aria')}
          className={`${CARD} flex min-h-[36vh] flex-col items-center justify-center gap-3 p-6 select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none] sm:min-h-[20rem] ${byCube ? '' : 'cursor-pointer'}`}
        >
          <TimerDisplay shown={shown} className={shown.kind === 'inspection' && phase === 'idle' ? 'text-zinc-700 dark:text-zinc-200' : DIGITS[phase]} />
          <p className={`text-center text-sm text-zinc-600 dark:text-zinc-300 ${aside}`}>
            {hint}
            {!byCube && <kbd className="ml-2 hidden font-mono text-[10px] opacity-70 sm:inline">Space</kbd>}
          </p>
        </div>

        {latest && <LatestSolve record={latest} className={aside} onUndo={onUndo} />}
      </div>

      <MemoRecords snapshot={solves} className={aside} onDelete={onDelete} />
    </div>
  );
}
