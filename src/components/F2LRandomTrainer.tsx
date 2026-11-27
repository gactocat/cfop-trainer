'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useF2LRandomSelection } from '@/hooks/useF2LRandomSelection';
import { useHoldTimer } from '@/hooks/useHoldTimer';
import { useMounted } from '@/hooks/useMounted';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
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
import { combineAuf, invertAuf, prefixAuf, splitF2LAuf } from '@/lib/f2l-auf';
import { buildF2LSetup, seededRandom } from '@/lib/f2l-scramble';
import { aufStartOf } from '@/lib/auf-start';
import { movesPerSecond, solutionMoves } from '@/lib/move-count';
import { saveCubeSolve, type CaseTimes } from '@/lib/practice-log';
import { aufDisplayOf } from '@/lib/practice-settings-store';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { guideTurns, remainingGuide } from '@/lib/test-cube-hints';
import { deleteSmartSolve } from '@/lib/smart-solve-store';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { F2L_IDS, type F2LAlgorithmRecord, type F2LId } from '@/types/f2l';
import type { Auf } from '@/types/pll';
import type { TrainerState } from '@/lib/practice-screen';
import { F2L3DPlayer } from './F2L3DPlayer';
import { PracticeScreens } from './PracticeScreens';
import { holdingFrame } from '@/lib/smart-cube/holding';

/** The case drawn, with the seed of its setup (scramble and orientation offset) and the round it was dealt from. */
interface Drawn {
  id: F2LId;
  seed: number;
  round: PracticeRound<F2LId> | null;
}

interface F2LTrainerProps {
  ids: readonly F2LId[];
  selected: ReadonlySet<F2LId>;
  /** The algorithm a case is set up and shown with; null falls back to speedcubedb's primary. */
  algorithmFor: (id: F2LId) => { auf: Auf; algorithm: string } | null;
  /** Case practice: one case, its solves saved to the algorithm. Random practice keeps them in the session only. */
  caseTimes?: CaseTimes;
}

// Random F2L practice: the cases ticked in the grid, with the starred
// algorithms; the solves stay in the session.
export function F2LRandomTrainer() {
  const { starredFor } = useF2LAlgorithms();
  const { selected } = useF2LRandomSelection();
  return <F2LTrainer ids={F2L_IDS} selected={selected} algorithmFor={starredFor} />;
}

// Practice of one algorithm from its case page: the same trainer with a
// single case, timed into that algorithm's times.
export function F2LCaseTrainer({ record }: { record: F2LAlgorithmRecord }) {
  const { addTime, removeTime } = useF2LAlgorithms();
  const { id, f2lId, auf, algorithm, times } = record;
  const ids = useMemo(() => [f2lId], [f2lId]);
  const selected = useMemo(() => new Set([f2lId]), [f2lId]);
  const algorithmFor = useCallback(() => ({ auf, algorithm }), [auf, algorithm]);
  const caseTimes = useMemo<CaseTimes>(() => ({
    add: (seconds) => addTime(id, seconds),
    remove: (timeId) => removeTime(id, timeId),
    best: bestSeconds(times),
    ao5: averageOfN(times, 5),
    count: times.length,
  }), [id, times, addTime, removeTime]);
  return <F2LTrainer ids={ids} selected={selected} algorithmFor={algorithmFor} caseTimes={caseTimes} />;
}

export function F2LTrainer({ ids, selected, algorithmFor, caseTimes }: F2LTrainerProps) {
  const { t, tn } = useT();
  const { settings: scrambleSettings } = usePracticeSettings();
  const aufMode = aufDisplayOf(scrambleSettings, 'f2l');
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
  const inverse = mode === 'inverse' || smartSetup;
  // Both setups and no-scramble show the case before timing, so draw it ahead.
  const drawAhead = inverse || noScramble;
  // The case with the seed for its setup, drawn together so the setup is
  // stable across re-renders but different on every draw.
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const current = drawn?.id ?? null;
  const setupSeed = drawn?.seed ?? 0;
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

  // Draw from the selected cases (all of `ids` if none, which cannot start),
  // with a fresh seed for the case's setup; null once a round is done.
  const pickRandom = useCallback((): Drawn | null => {
    const id = round.round
      ? round.nextCase
      : pickStaleWeighted(pool.length > 0 ? pool : ids, (id) => lastSolved.get(id), Date.now());
    return id === null ? null : { id, seed: Math.floor(Math.random() * 0x7fffffff), round: round.round };
  }, [round.round, round.nextCase, pool, ids, lastSolved]);

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

  // In inverse mode the start screen shows the scramble, so a case is drawn as
  // soon as the trainer is idle without one (first client render, after each
  // solve, or when the mode is switched); standard mode draws on start. This is
  // the "adjust state during render" pattern: React re-renders immediately with
  // the new state. Gated on `mounted` so the server markup stays deterministic.
  // A round switched on or dealt again redraws the case from it.
  if (mounted && state === 'idle' && drawAhead && !noneSelected && !complete &&
      (drawn === null || drawn.round !== round.round || !selected.has(drawn.id))) {
    setDrawn(pickRandom());
    setAgain(false);
  }

  const start = useCallback(() => {
    if (!mounted || noneSelected || complete) return;
    // With setup (or a cube), the case already shown is timed; without, one
    // is drawn now (unless the same case goes again).
    if ((!drawAhead && !again) || !current) {
      const next = pickRandom();
      if (!next) return;
      setDrawn(next);
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

  // On to the next case.
  const next = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setAgain(false);
    setDrawn(null);
  }, []);

  // The same case again, from the case screen.
  const retry = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setAgain(true);
  }, []);

  // Abandon the attempt but keep the case (a reset while timing, Escape, leaving the app).
  const abort = useCallback(() => {
    setState('idle');
    setElapsed(0);
  }, []);

  // Everything the three case screens need, derived once from the drawn case
  // and its seed. The given algorithm (the starred one in random practice)
  // wins; the speedcubedb primary, whose leading U turn is its AUF, is the
  // fallback.
  const shown = useMemo(() => {
    if (!current) return null;
    const def = getF2LDefinition(current);
    const star = algorithmFor(current);
    const primary = splitF2LAuf(def?.primaryAlg ?? '');
    const auf: Auf = star?.auf ?? primary.auf;
    const body = star?.algorithm ?? primary.rest;
    const setup = buildF2LSetup(current, { auf, body }, aufStartOf(scrambleSettings), seededRandom(setupSeed));
    // The U turn needed from the shown orientation before the body.
    const effectiveAuf = combineAuf(invertAuf(setup.uOffset), auf);
    return { def, star, auf, body, setup, effectiveAuf };
  }, [current, algorithmFor, scrambleSettings, setupSeed]);
  const nameOf = (id: F2LId) => {
    const def = getF2LDefinition(id);
    return def ? t('common.f2lCase', { number: def.number }) : id;
  };

  // Without a cube: stopping records the solve in the session at once (and,
  // in case practice, in the algorithm's times); Undo takes it back.
  const stop = useCallback(() => {
    const seconds = (Date.now() - startRef.current) / 1000;
    stopWith(seconds);
    if (!current || !shown || seconds <= 0) return;
    const moveCount = shown.body ? solutionMoves(shown.effectiveAuf, shown.body) : null;
    const timeId = caseTimes?.add(seconds) ?? null;
    log.add({
      caseId: current,
      name: shown.def ? t('common.f2lCase', { number: shown.def.number }) : current,
      solution: shown.body ? prefixAuf(shown.effectiveAuf, shown.body) : '',
      seconds,
      recognitionMs: null,
      moveCount,
      tps: moveCount === null ? null : movesPerSecond(moveCount, seconds),
    }, timeId && caseTimes ? () => caseTimes.remove(timeId) : null);
  }, [current, shown, caseTimes, log, t, stopWith]);

  // With a smart cube, either flow runs from the cube: solves are recorded in
  // this session's log as they stop, and the next case follows on Next, or by
  // itself once the cube rests when auto-advance is on.
  const { autoAdvance, holding: cubeHolding } = useSmartCubeSettings();
  const cubeFlow = {
    practice: 'f2l' as const,
    scramble: shown ? shown.setup.scramble : null,
    trainerState: state,
    autoAdvance,
    log,
    describe: () => shown && current && {
      caseId: current,
      name: nameOf(current),
      solution: shown.body ? prefixAuf(shown.effectiveAuf, shown.body) : '',
    },
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
  // Leaving the app abandons the attempt (a cube-driven solve is recorded on its own otherwise).
  useNativeTimer(state === 'running', noScramble ? virtual.reset : abort);
  useEffect(() => { startBlockedRef.current = cubeDriven && !cube.connected; });
  // For the test cube: the setup still to make and the case's solution, in one tap.
  useOfferTestCubeMoves(!shown ? [] : [
    ...(smartSetup && guided.view ? [{
      kind: 'setup' as const, alg: remainingGuide(guided.view.plan.tokens, guided.view), ...guideTurns(guided.view.plan, guided.view.progress),
    }] : []),
    ...(cubeDriven && shown.body ? [{ kind: 'solution' as const, alg: prefixAuf(shown.effectiveAuf, shown.body), grip: holdingFrame(cubeHolding) }] : []),
  ]);

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
  // The speedcubedb primary stands in (greyed) when no algorithm is saved.
  const solution = shown && (shown.body ? (
    aufMode === 'cube' ? (
      <span className={shown.star ? '' : 'text-zinc-500'}>
        <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
          {shown.effectiveAuf}
        </span>
        {shown.body}
      </span>
    ) : (
      <span className={shown.star ? '' : 'text-zinc-500'}>{prefixAuf(shown.effectiveAuf, shown.body)}</span>
    )
  ) : (
    <span className="italic text-zinc-500">{t('trainer.f2l.noAlgorithm')}</span>
  ));

  return (
    <PracticeScreens
      practice="f2l"
      scope={single ? 'case' : 'random'}
      flavor={mode}
      state={state}
      hold={hold}
      elapsed={elapsed}
      setup={inverse && shown ? shown.setup.scramble : null}
      caseLook={shown && (
        <F2L3DPlayer
          algorithm={shown.body}
          setupAlg={shown.def?.setupAlg ?? ''}
          auf={shown.auf}
          uOffset={shown.setup.uOffset}
          interactive={false}
          className="w-full h-full"
        />
      )}
      virtual={virtual.view}
      guided={guided.view}
      results={results}
      settle={settle}
      solution={solution}
      caseStats={caseTimes && caseTimes.count > 0
        ? t('detail.caseStats', { best: formatSeconds(caseTimes.best), ao5: formatSeconds(caseTimes.ao5), solves: tn('common.solves', caseTimes.count) })
        : undefined}
      progress={position && t('practice.round.progress', position)}
      sessionNote={single ? undefined : t('trainer.session.notKept')}
      empty={noneSelected && (
        <div className="flex flex-col items-center gap-2 text-center text-zinc-500 dark:text-zinc-400">
          <div className="text-sm font-medium uppercase tracking-wider">{t('trainer.noneSelected')}</div>
          <div className="text-xs">{t('trainer.f2l.tickOne')}</div>
        </div>
      )}
      roundDone={complete && round.round
        ? { total: round.round.order.length, results: round.results, listHref: '/f2l', onRestart: round.restart }
        : null}
      onNext={cubeDriven ? cube.next : next}
      onUndo={(key) => log.undo(key)}
      onRetry={() => { log.clearSettle(); retry(); }}
      onStopByHand={cube.stopByHand}
      onReset={virtual.reset}
    />
  );
}
