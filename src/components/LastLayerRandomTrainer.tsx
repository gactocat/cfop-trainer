'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useMounted } from '@/hooks/useMounted';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useNativeTimer } from '@/hooks/useNativeTimer';
import { recordSmartSolve, type SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { useNoScrambleTrainer } from '@/hooks/useNoScrambleTrainer';
import { usePracticeLog } from '@/hooks/usePracticeLog';
import { useSmartSetupPractice } from '@/hooks/useSmartSetupPractice';
import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useTrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useLastLayerSolver } from '@/hooks/useLastLayerSolver';
import { pickAlternativeSetup } from '@/lib/last-layer-alternatives';
import { alignedOffset, buildLastLayerSetup, type LastLayerAlgorithm, type LastLayerSetup } from '@/lib/last-layer-setup';
import { aufStartOf, caseOffset } from '@/lib/auf-start';
import type { LastLayerPractice } from '@/types/practice';
import { aufDisplayOf, type PracticeSettings } from '@/lib/practice-settings-store';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { deleteSmartSolve } from '@/lib/smart-solve-store';
import { formatSeconds } from '@/lib/stats';
import { LastLayerPlayer } from './LastLayerPlayer';
import { NoScrambleStage } from './NoScrambleStage';
import { SmartSetupStage } from './SmartSetupStage';

type TrainerState = 'idle' | 'running' | 'stopped';
interface Pick<Id> {
  id: Id;
  setup: LastLayerSetup;
  settings: PracticeSettings;
  // Whether the cube model was available, i.e. the setup could use another
  // algorithm's inverse. A pick made before it loaded is redrawn once it has.
  withSolver: boolean;
  // Drawn for inverse mode (varied setups) rather than no-scramble.
  inverse: boolean;
}
interface Props<Id extends string> {
  practice: LastLayerPractice;
  ids: readonly Id[];
  selected: Set<Id>;
  algorithmFor: (id: Id) => LastLayerAlgorithm;
  // Every known algorithm for the case (with AUF prefix), used to vary the
  // inverse setup.
  alternativesFor: (id: Id) => readonly string[];
  nameFor: (id: Id) => string;
  lastRecorded: Map<Id, number>;
  add: (id: Id, seconds: number) => string | null;
  remove: (solveId: string) => void;
  bestFor: (id: Id) => number | null;
  ao5For: (id: Id) => number | null;
  solvesFor: (id: Id) => unknown[];
  /** Case practice: one case, recorded to one algorithm, so no selection note. */
  single?: boolean;
}

export function LastLayerRandomTrainer<Id extends string>({
  practice, ids, selected, algorithmFor, alternativesFor, nameFor, lastRecorded, add, remove, bestFor, ao5For, solvesFor,
  single = false,
}: Props<Id>) {
  const { t, tn } = useT();
  const { settings } = usePracticeSettings();
  // Fixed when the practice started (see TrainerFlavorContext). No setup runs
  // on the virtual cube with a smart cube and as the tap timer without one;
  // with setup is guided on the cube with one, and applied by hand without.
  const mode = useTrainerMode();
  const noScramble = mode === 'no-scramble';
  const smartSetup = mode === 'smart-setup';
  const cubeDriven = noScramble || smartSetup;
  // A setup to make on the cube (by hand or guided), varied between algorithms.
  const inverse = mode === 'inverse' || smartSetup;
  // Both setups and no-scramble show the case before timing, so draw it ahead.
  const drawAhead = inverse || noScramble;
  const solver = useLastLayerSolver();
  const [state, setState] = useState<TrainerState>('idle');
  const [current, setCurrent] = useState<Pick<Id> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mounted = useMounted();
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // A cube-driven practice without a connected cube has nothing to solve, so Space waits.
  const startBlockedRef = useRef(false);

  // Snapshot the solution, settings and offset together. The scramble
  // remains identical from the setup screen through recording the solve.
  const pickRandom = useCallback((): Pick<Id> => {
    const pool = ids.filter((id) => selected.has(id));
    const id = pickStaleWeighted(pool.length ? pool : ids, (id) => lastRecorded.get(id), Date.now());
    const algorithm = algorithmFor(id);
    const aufDisplay = aufDisplayOf(settings, practice);
    const offset = caseOffset(aufStartOf(settings), alignedOffset(algorithm, aufDisplay));
    const setup = buildLastLayerSetup(algorithm, aufDisplay, offset, (plain) =>
      inverse
        ? pickAlternativeSetup(solver, practice, plain, alternativesFor(id))
        : plain);
    return { id, setup, settings, withSolver: solver !== null, inverse };
  }, [ids, selected, lastRecorded, settings, algorithmFor, alternativesFor, solver, practice, inverse]);

  const noneSelected = mounted && selected.size === 0;

  useEffect(() => {
    if (state !== 'running') return;
    const tick = () => {
      setElapsed((Date.now() - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [state]);

  // Refresh only while idle when the selection or settings change.
  if (mounted && state === 'idle' && drawAhead && !noneSelected &&
      (!current || !selected.has(current.id) || current.settings !== settings ||
        current.withSolver !== (solver !== null) || current.inverse !== inverse)) {
    setCurrent(pickRandom());
  }

  const start = useCallback(() => {
    if (!mounted || noneSelected) return;
    if (!drawAhead || !current) setCurrent(pickRandom());
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, [pickRandom, mounted, noneSelected, drawAhead, current]);

  const stop = useCallback(() => {
    setElapsed((Date.now() - startRef.current) / 1000);
    setState('stopped');
  }, []);

  // Stop with a time measured elsewhere (the smart cube's clock).
  const stopWith = useCallback((seconds: number) => {
    setElapsed(seconds);
    setState('stopped');
  }, []);

  // Abandon the attempt but keep the case (no-scramble reset while timing).
  const abort = useCallback(() => {
    setState('idle');
    setElapsed(0);
  }, []);

  const discard = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  }, []);

  // With a smart cube, either flow runs from the cube: solves are recorded in
  // this session's log as they stop, and the next case follows on Next, or by
  // itself once the cube rests when auto-advance is on.
  const { autoAdvance } = useSmartCubeSettings();
  const { log, results, settle } = usePracticeLog();
  const cubeFlow = {
    practice,
    scramble: current ? current.setup.scramble : null,
    trainerState: state,
    autoAdvance,
    log,
    describe: () => current && { caseId: current.id, name: nameFor(current.id), solution: current.setup.solution },
    record: (caseId: string, seconds: number, solve: SmartSolve | null) => {
      const solveId = add(caseId as Id, seconds);
      const smartId = solve ? recordSmartSolve(solve, caseId) : null;
      if (!solveId && !smartId) return null;
      return () => {
        if (solveId) remove(solveId);
        if (smartId) void deleteSmartSolve(smartId);
      };
    },
    onStart: start,
    onStop: (seconds: number | null) => {
      const settled = seconds ?? (Date.now() - startRef.current) / 1000;
      stopWith(settled);
      return settled;
    },
    onAdvance: discard,
  };
  // No setup: the case on a virtual cube, moved by the smart cube's turns.
  const virtual = useNoScrambleTrainer({ ...cubeFlow, active: noScramble, onAbort: abort });
  // With setup: the setup guided on the cube itself.
  const guided = useSmartSetupPractice({ ...cubeFlow, active: smartSetup });
  const cube = noScramble ? virtual : guided;
  useEffect(() => { startBlockedRef.current = cubeDriven && !cube.connected; });

  // Leaving the app abandons a cube-driven attempt (it is recorded on its own otherwise).
  useNativeTimer(state === 'running', noScramble ? virtual.reset : smartSetup ? abort : stop);

  const record = useCallback(() => {
    if (current && elapsed > 0) add(current.id, elapsed);
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  }, [current, elapsed, add]);

  // Keyboard: Space mirrors the tap action (idle → start, running → stop) and
  // records on the result screen; Escape discards there. When the cube drives
  // the practice the solve is already recorded, so Space goes on and Escape
  // takes it back.
  const latest = results[0];
  const onSpace = useCallback(() => {
    if (state === 'idle') {
      if (!noneSelected && !startBlockedRef.current) start();
    } else if (state === 'running') {
      if (cubeDriven) cube.stopByHand();
      else stop();
    } else if (cubeDriven) cube.next();
    else record();
  }, [state, start, stop, record, noneSelected, cubeDriven, cube]);
  useSpacebar(onSpace);
  useEscapeKey(
    cubeDriven ? () => { if (latest && !latest.undone) log.undo(latest.key); } : discard,
    state === 'stopped',
  );

  // The tap trainers' result screen (standard and inverse setup).
  const previousSolves = current ? solvesFor(current.id).length : 0;
  const resultInfo = current && (
    <div className="text-center sm:text-left">
      <div className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
        {nameFor(current.id)}
      </div>
      <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
        {elapsed.toFixed(3)}
      </div>
      {previousSolves > 0 && (
        <div className="mt-1 text-xs font-mono text-amber-700/80 dark:text-amber-300/80">
          {t(single ? 'detail.caseStats' : 'detail.randomStats', {
            best: formatSeconds(bestFor(current.id)),
            ao5: formatSeconds(ao5For(current.id)),
            solves: tn('common.solves', previousSolves),
          })}
        </div>
      )}
    </div>
  );
  const resultRest = current && (
    <>
      <div className="max-w-2xl w-full text-center font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">
        <p>
          {aufDisplayOf(current.settings, practice) === 'prefix' ? current.setup.solution : <>
            <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
              {current.setup.effectiveAuf}
            </span>
            {current.setup.body}
          </>}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={record}
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 font-semibold"
        >
          ✓ {t('common.record')}
          <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Space</kbd>
        </button>
        <button
          type="button"
          onClick={discard}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ✗ {t('common.discard')}
          <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Esc</kbd>
        </button>
      </div>
    </>
  );

  const selectedNote = mounted && !single ? t('trainer.selectedCount', { count: selected.size, total: ids.length }) : '';

  if (noScramble && !noneSelected) {
    return (
      <NoScrambleStage
        state={state} view={virtual.view} connected={virtual.connected} log={{ results, settle }}
        elapsed={elapsed} selectedNote={selectedNote}
        onReset={virtual.reset} onStop={virtual.stopByHand} onNext={virtual.next} onUndo={(key) => log.undo(key)}
      />
    );
  }

  if (smartSetup && !noneSelected) {
    return (
      <SmartSetupStage
        practice={practice} state={state} view={guided.view} connected={guided.connected} log={{ results, settle }}
        elapsed={elapsed} selectedNote={selectedNote}
        onStop={guided.stopByHand} onNext={guided.next} onUndo={(key) => log.undo(key)}
      />
    );
  }

  if (state === 'stopped' && current) {
    return (
      <div className="w-full flex-1 rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900">
            <LastLayerPlayer practice={practice} setupAlg={current.setup.scramble} size={220} />
          </div>
          {resultInfo}
        </div>
        {resultRest}
      </div>
    );
  }

  if (state === 'running' && current) {
    return (
      <button
        type="button"
        onPointerDown={stop}
        className="w-full flex-1 min-h-[280px] rounded-lg flex flex-col items-center justify-center gap-4 sm:gap-8 transition-colors select-none touch-none bg-rose-500 hover:bg-rose-600 text-white"
        aria-label={t('trainer.tapToStopAria')}
      >
        <div className="rounded-md p-2 bg-white/15">
          <LastLayerPlayer practice={practice} setupAlg={current.setup.scramble} size={220} />
        </div>
        <div
          className="font-mono text-6xl sm:text-8xl font-bold tabular-nums leading-none"
          aria-live="polite"
        >
          {elapsed.toFixed(3)}
        </div>
        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
          {t('trainer.tapOrSpaceToStop')}
        </div>
      </button>
    );
  }

  if (noneSelected) {
    return (
      <div className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-2 select-none bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
        <div className="text-sm font-medium uppercase tracking-wider">
          {t('trainer.noneSelected')}
        </div>
        <div className="text-xs">{t(practice === 'oll' ? 'trainer.oll.tickOne' : 'trainer.pll.tickOne')}</div>
      </div>
    );
  }

  if (inverse) {
    return (
      <button
        type="button"
        onPointerDown={start}
        className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-4 px-6 transition-colors select-none touch-none text-white bg-emerald-500 hover:bg-emerald-600"
        aria-label={t('trainer.tapToStartAria')}
      >
        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
          {t('trainer.applyToCube')}
        </div>
        <div className="max-w-2xl w-full text-center font-mono text-3xl sm:text-4xl font-bold break-words leading-snug">
          {current?.setup.scramble || '…'}
        </div>
        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
          {t('trainer.tapOrSpaceToStart')}
        </div>
        <div className="text-xs opacity-75">{selectedNote}</div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={start}
      className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-3 transition-colors select-none touch-none bg-emerald-500 hover:bg-emerald-600 text-white"
      aria-label={t('trainer.tapToStartAria')}
    >
      <div className="font-mono text-6xl sm:text-8xl font-bold tabular-nums leading-none">
        0.000
      </div>
      <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
        {t('trainer.tapOrSpaceToStart')}
      </div>
      <div className="text-xs opacity-75">{selectedNote}</div>
    </button>
  );
}
