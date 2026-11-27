'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useHoldTimer } from '@/hooks/useHoldTimer';
import { useMounted } from '@/hooks/useMounted';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useNativeTimer } from '@/hooks/useNativeTimer';
import { recordSmartSolve, type SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { useNoScrambleTrainer } from '@/hooks/useNoScrambleTrainer';
import { usePracticeLog } from '@/hooks/usePracticeLog';
import { usePracticeOptions, usePracticeRound, type PracticeRound } from '@/hooks/usePracticeRound';
import { useOfferTestCubeMoves } from '@/hooks/useTestCube';
import { useSmartSetupPractice } from '@/hooks/useSmartSetupPractice';
import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import { usePracticeFlavor } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useLastLayerSolver } from '@/hooks/useLastLayerSolver';
import { pickAlternativeSetup } from '@/lib/last-layer-alternatives';
import { buildPracticeSetup, type LastLayerAlgorithm, type LastLayerSetup } from '@/lib/last-layer-setup';
import { aufStartOf, caseOffset } from '@/lib/auf-start';
import { movesPerSecond, solutionMoves } from '@/lib/move-count';
import { saveCubeSolve, type CaseTimes } from '@/lib/practice-log';
import type { LastLayerPractice } from '@/types/practice';
import { aufDisplayOf, type PracticeSettings } from '@/lib/practice-settings-store';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { guideTurns, remainingGuide } from '@/lib/test-cube-hints';
import { deleteSmartSolve } from '@/lib/smart-solve-store';
import { formatSeconds } from '@/lib/stats';
import type { TrainerState } from '@/lib/practice-screen';
import { LastLayerPlayer } from './LastLayerPlayer';
import { PracticeScreens } from './PracticeScreens';
import { holdingFrame } from '@/lib/smart-cube/holding';

interface Pick<Id extends string> {
  id: Id;
  setup: LastLayerSetup;
  settings: PracticeSettings;
  // Whether the cube model was available, i.e. the setup could use another
  // algorithm's inverse. A pick made before it loaded is redrawn once it has.
  withSolver: boolean;
  // Drawn for inverse mode (varied setups) rather than no-scramble.
  inverse: boolean;
  // The round of "each selected case once" it was dealt from, if any.
  round: PracticeRound<Id> | null;
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
  /** Case practice: one case, its solves saved to the algorithm. Random practice keeps them in the session only. */
  caseTimes?: CaseTimes;
}

export function LastLayerRandomTrainer<Id extends string>({
  practice, ids, selected, algorithmFor, alternativesFor, nameFor, caseTimes,
}: Props<Id>) {
  const { t, tn } = useT();
  const { settings } = usePracticeSettings();
  const single = caseTimes !== undefined;
  const [state, setState] = useState<TrainerState>('idle');
  // As the settings and the cube say between cases, kept through an attempt
  // (see usePracticeFlavor). No setup runs on the virtual cube with a smart
  // cube and as the hold timer without one; with setup is guided on the
  // cube with one, and applied by hand without.
  const mode = usePracticeFlavor(state !== 'idle');
  const noScramble = mode === 'no-scramble';
  const smartSetup = mode === 'smart-setup';
  const cubeDriven = noScramble || smartSetup;
  // A setup to make on the cube (by hand or guided), varied between algorithms.
  const inverse = mode === 'inverse' || smartSetup;
  // Both setups and no-scramble show the case before timing, so draw it ahead.
  const drawAhead = inverse || noScramble;
  const solver = useLastLayerSolver();
  const [current, setCurrent] = useState<Pick<Id> | null>(null);
  // Same case again: the next start keeps the case on screen instead of drawing one.
  const [again, setAgain] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mounted = useMounted();
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // A cube-driven practice without a connected cube has nothing to solve, so Space waits.
  const startBlockedRef = useRef(false);

  // This session's solves, in memory only: leaving the page begins a new one.
  const { log, results, settle } = usePracticeLog();
  const latest = results[0];
  const pool = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected]);
  // Each selected case once (random practice), dealt when switched on.
  const { eachOnce } = usePracticeOptions();
  const round = usePracticeRound({ on: mounted && eachOnce && !single, pool, results, idle: state === 'idle' });
  const complete = round.complete;
  // Cases not solved yet in this session come up more often.
  const lastSolved = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results) if (!r.undone && !map.has(r.caseId)) map.set(r.caseId, r.at);
    return map;
  }, [results]);

  // Snapshot the solution, settings and offset together. The scramble
  // remains identical from the setup screen through recording the solve.
  const pickRandom = useCallback((): Pick<Id> | null => {
    const id = round.round
      ? round.nextCase
      : pickStaleWeighted(pool.length ? pool : ids, (id) => lastSolved.get(id), Date.now());
    if (id === null) return null;
    const algorithm = algorithmFor(id);
    const offset = caseOffset(aufStartOf(settings), algorithm.auf);
    const setup = buildPracticeSetup(algorithm, offset, (plain) =>
      inverse
        ? pickAlternativeSetup(solver, practice, plain, alternativesFor(id))
        : plain);
    return { id, setup, settings, withSolver: solver !== null, inverse, round: round.round };
  }, [round.round, round.nextCase, pool, ids, lastSolved, settings, algorithmFor, alternativesFor, solver, practice, inverse]);

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

  // Refresh only while idle when the selection, the settings or the round
  // change: a change made while a case waits takes effect with a new case
  // (the same case again included).
  if (mounted && state === 'idle' && drawAhead && !noneSelected && !complete &&
      (!current || !selected.has(current.id) || current.settings !== settings ||
        current.withSolver !== (solver !== null) || current.inverse !== inverse || current.round !== round.round)) {
    setCurrent(pickRandom());
    setAgain(false);
  }

  const start = useCallback(() => {
    if (!mounted || noneSelected || complete) return;
    if ((!drawAhead && !again) || !current) {
      const next = pickRandom();
      if (!next) return;
      setCurrent(next);
    }
    setAgain(false);
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, [pickRandom, mounted, noneSelected, complete, drawAhead, again, current]);

  // Stop with a time measured elsewhere (the smart cube's clock).
  const stopWith = useCallback((seconds: number) => {
    setElapsed(seconds);
    setState('stopped');
  }, []);

  // Abandon the attempt but keep the case (a reset while timing, Escape, leaving the app).
  const abort = useCallback(() => {
    setState('idle');
    setElapsed(0);
  }, []);

  // On to the next case.
  const next = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setAgain(false);
    setCurrent(null);
  }, []);

  // The same case again, from the case screen.
  const retry = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setAgain(true);
  }, []);

  // Without a cube: stopping records the solve in the session at once (and,
  // in case practice, in the algorithm's times); Undo takes it back.
  const stop = useCallback(() => {
    const seconds = (Date.now() - startRef.current) / 1000;
    stopWith(seconds);
    if (!current || seconds <= 0) return;
    const moveCount = solutionMoves(current.setup.effectiveAuf, current.setup.body);
    const timeId = caseTimes?.add(seconds) ?? null;
    log.add({
      caseId: current.id,
      name: nameFor(current.id),
      solution: current.setup.solution,
      seconds,
      recognitionMs: null,
      moveCount,
      tps: moveCount === null ? null : movesPerSecond(moveCount, seconds),
    }, timeId && caseTimes ? () => caseTimes.remove(timeId) : null);
  }, [current, caseTimes, log, nameFor, stopWith]);

  // With a smart cube, either flow runs from the cube: solves are recorded in
  // this session's log as they stop, and the next case follows on Next, or by
  // itself once the cube rests when auto-advance is on.
  const { autoAdvance, holding: cubeHolding } = useSmartCubeSettings();
  const cubeFlow = {
    practice,
    scramble: current ? current.setup.scramble : null,
    trainerState: state,
    autoAdvance,
    log,
    describe: () => current && { caseId: current.id, name: nameFor(current.id), solution: current.setup.solution },
    // Random practice keeps its solves in the session only; case practice
    // also saves the time and the cube's record of the solve.
    record: (caseId: string, seconds: number, solve: SmartSolve | null) => saveCubeSolve({
      caseTimes, seconds, solve,
      saveSmart: (smart) => recordSmartSolve(smart, caseId),
      deleteSmart: (id) => { void deleteSmartSolve(id); },
    }),
    onStart: start,
    onStop: (seconds: number | null) => {
      const settled = seconds ?? (Date.now() - startRef.current) / 1000;
      stopWith(settled);
      return settled;
    },
    onAdvance: next,
  };
  // No setup: the case on a virtual cube, moved by the smart cube's turns.
  const virtual = useNoScrambleTrainer({ ...cubeFlow, active: noScramble, onAbort: abort });
  // With setup: the setup guided on the cube itself.
  const guided = useSmartSetupPractice({ ...cubeFlow, active: smartSetup });
  const cube = noScramble ? virtual : guided;
  useEffect(() => { startBlockedRef.current = cubeDriven && !cube.connected; });
  // For the test cube: the setup still to make and the case's solution, in one tap.
  useOfferTestCubeMoves(!current ? [] : [
    ...(smartSetup && guided.view ? [{
      kind: 'setup' as const, alg: remainingGuide(guided.view.plan.tokens, guided.view), ...guideTurns(guided.view.plan, guided.view.progress),
    }] : []),
    ...(cubeDriven ? [{ kind: 'solution' as const, alg: current.setup.solution, grip: holdingFrame(cubeHolding) }] : []),
  ]);

  // Leaving the app abandons the attempt (a cube-driven solve is recorded on its own otherwise).
  useNativeTimer(state === 'running', noScramble ? virtual.reset : abort);

  // Without a cube: hold to start, let go to go, press to stop; Space too.
  // Without a setup to make first, Space on the result holds for the next case at once.
  const hold = useHoldTimer({
    active: !cubeDriven && mounted && !noneSelected && !complete,
    state, pressOnNext: !drawAhead, onStart: start, onStop: stop, onAbort: abort, onNext: next,
  });
  // With a cube, Space stops by hand while timing and goes on from the result.
  const onSpace = useCallback(() => {
    if (state === 'idle') {
      if (!noneSelected && !startBlockedRef.current) start();
    } else if (state === 'running') cube.stopByHand();
    else cube.next();
  }, [state, start, noneSelected, cube]);
  useSpacebar(onSpace, cubeDriven && !complete);
  // Escape takes back the latest solve on the result screen.
  useEscapeKey(() => { if (latest && !latest.undone) log.undo(latest.key); }, state === 'stopped');

  const showingKept = state === 'stopped' && !!latest && !latest.undone;
  const position = round.position(showingKept);
  const shown = current && (
    aufDisplayOf(current.settings, practice) === 'prefix' ? current.setup.solution : <>
      <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
        {current.setup.effectiveAuf}
      </span>
      {current.setup.body}
    </>
  );

  return (
    <PracticeScreens
      practice={practice}
      scope={single ? 'case' : 'random'}
      flavor={mode}
      state={state}
      hold={hold}
      elapsed={elapsed}
      setup={inverse && current ? current.setup.scramble : null}
      caseLook={current && <LastLayerPlayer practice={practice} setupAlg={current.setup.scramble} className="h-full w-full" />}
      virtual={virtual.view}
      guided={guided.view}
      results={results}
      settle={settle}
      solution={shown}
      caseStats={caseTimes && caseTimes.count > 0
        ? t('detail.caseStats', { best: formatSeconds(caseTimes.best), ao5: formatSeconds(caseTimes.ao5), solves: tn('common.solves', caseTimes.count) })
        : undefined}
      progress={position && t('practice.round.progress', position)}
      sessionNote={single ? undefined : t('trainer.session.notKept')}
      empty={noneSelected && (
        <div className="flex flex-col items-center gap-2 text-center text-zinc-500 dark:text-zinc-400">
          <div className="text-sm font-medium uppercase tracking-wider">{t('trainer.noneSelected')}</div>
          <div className="text-xs">{t(practice === 'oll' ? 'trainer.oll.tickOne' : 'trainer.pll.tickOne')}</div>
        </div>
      )}
      roundDone={complete && round.round
        ? { total: round.round.order.length, results: round.results, listHref: `/${practice}`, onRestart: round.restart }
        : null}
      onNext={cubeDriven ? cube.next : next}
      onUndo={(key) => log.undo(key)}
      onRetry={() => { log.clearSettle(); retry(); }}
      onStopByHand={cube.stopByHand}
      onReset={virtual.reset}
    />
  );
}
