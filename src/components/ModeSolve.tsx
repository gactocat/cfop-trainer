'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCubeSolve } from '@/hooks/useCubeSolve';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useHoldTimer } from '@/hooks/useHoldTimer';
import { useMounted } from '@/hooks/useMounted';
import { useKeepAwake, useNativeTimer } from '@/hooks/useNativeTimer';
import { useScramble } from '@/hooks/useScramble';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useSolveSettings } from '@/hooks/useSolveSettings';
import { useSolves } from '@/hooks/useSolves';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useT } from '@/hooks/useT';
import { useOfferTestCubeMoves } from '@/hooks/useTestCube';
import { invertAlg } from '@/lib/invert-alg';
import { FACE_COLOUR } from '@/lib/smart-cube/holding';
import { deleteSolve, saveSolve } from '@/lib/solve-store';
import { solveTps } from '@/lib/solve/cfop-split';
import { inspectionPenalty } from '@/lib/solve/inspection';
import { modeHandSolve, modeMoveCount, readModeRecord } from '@/lib/solve/mode-record';
import { scrambleCrossFace } from '@/lib/solve/mode-scramble';
import { scrambleState } from '@/lib/solve/scramble';
import { DEFAULT_MODE_CROSS, SOLVE_MODE, type SolveMode } from '@/lib/solve/solve-modes';
import { solveScreenOf, timerFaceOf } from '@/lib/solve/solve-screen';
import type { Penalty, SolveRecord } from '@/lib/solve/solve-record';
import { remainingGuide } from '@/lib/test-cube-hints';
import { setTimerFocus } from '@/lib/timer-focus';
import { useScreenHidden } from './KeptScreen';
import { SolveRecordsButton } from './SolveRecordsButton';
import { cubeSolveStatus, DnfButton, ResultHead, ScrambleHead, SolveFrame, TimerHead } from './SolveScreens';
import { SolveStages } from './SolveStages';
import { SolveToolbar } from './SolveToolbar';
import { VirtualCube } from './VirtualCube';

// A solve from a random-state scramble, of any kind (solve-modes.ts): a
// whole CFOP solve, or the cross, F2L or the last layer on its own, whose
// scramble leaves the parts before it solved and whose solve ends when its
// part is done. The same three screens in turn for each:
//
// - Scramble: the scramble, a 3D cube (the scrambled cube in the scramble
//   orientation; with a smart cube, the cube as it is, turning the next move
//   part of the way), the smart cube and the new scramble and settings
//   buttons. The records are a page under it, from an icon in the header;
//   this screen stays as it is behind them (KeptScreen).
// - Timer: with a smart cube, it comes by itself once the cube is scrambled:
//   the inspection counts up (when on) until the first turn starts the
//   timer, and the cube reaching the mode's goal stops it (solved, a cross
//   of any colour, the first two layers); the cube shows small, with a quiet
//   DNF. Without one, a press held on the scramble screen brings it up: red
//   0.00, green once letting go starts, then the timer runs until a press
//   anywhere (or Space). With inspection on, a tap starts the inspection
//   first and the press is held from there. Starting after 15 s of
//   inspection adds +2, after 17 s DNF.
// - Result: the time where the timer was, its moves, TPS, inspection and
//   cross colour (not for the last layer, whose cross was there before), the
//   scramble, Retry (the same scramble) and Next; with a cube, the mode's
//   stages. +2, DNF and Undo stay in reach.
//
// Each kind keeps its own settings and records (its `event`). Solves are
// kept on the device, or in the account when signed in, as soon as they
// stop.
export function ModeSolve({ mode }: { mode: SolveMode }) {
  const { t } = useT();
  const mounted = useMounted();
  // Behind its records or one solve of them (see KeptScreen).
  const hidden = useScreenHidden();
  const settings = useSolveSettings(mode);
  const inspectionOn = mounted && settings.inspection;
  const cube = useSmartCube();
  const connected = mounted && cube.status === 'connected';
  // F2L and the last layer: the scramble leaves a white cross where the scramble orientation puts it.
  const cross = DEFAULT_MODE_CROSS;
  const face = SOLVE_MODE[mode].setsCross ? scrambleCrossFace({ top: settings.top, front: settings.front }, cross) ?? 'U' : undefined;
  const { scramble, failed, next } = useScramble({ mode, face });
  const solves = useSolves(mode);
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
  // The solve on the result screen, as saved (penalties set later show from the store).
  const [latest, setLatest] = useState<SolveRecord | null>(null);
  // Once saved it shows from the store (penalties set later); deleted from
  // its page under this one, it is gone from the result too.
  const stored = latest === null ? undefined : solves.solves.find((s) => s.id === latest.id);
  const [seen, setSeen] = useState<string | null>(null);
  if (stored && seen !== stored.id) setSeen(stored.id);
  const result = latest === null || (!stored && seen === latest.id) ? null : stored ?? latest;

  // When the last solve stopped: the Space that stopped it must not also go on to the next.
  const stoppedAt = useRef(-Infinity);
  const record = useCallback((solve: SolveRecord) => {
    stoppedAt.current = performance.now();
    // Shown at once; kept for this visit only when it cannot be stored.
    saveSolve(solve).catch(() => {});
    setLatest(solve);
    setTimer(null);
    setInspecting(null);
  }, []);

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
  const stopByHand = (penalty?: Penalty) => {
    if (timer) record(modeHandSolve(mode, timer.scramble, performance.now() - timer.since, { penalty: penalty ?? timer.penalty, inspectionMs: timer.inspectionMs }));
  };

  // With a smart cube: guided scramble, then the cube starts and stops.
  // Off on the result screen, so turning the cube there starts nothing.
  const byCube = connected && result === null && timer?.by !== 'hand' && inspecting === null && !hidden;
  const cubeSolve = useCubeSolve({
    mode,
    cross,
    active: byCube,
    scramble,
    holding: settings,
    onStart: (inspectionMs) => begin('cube', inspectionMs),
    onStop: (solve) => record({ ...solve, ...(timer?.penalty ? { penalty: timer.penalty } : {}), ...(timer?.inspectionMs !== undefined ? { inspectionMs: Math.round(timer.inspectionMs) } : {}) }),
  });
  const screen = cubeSolve.screen;
  const cubeReady = byCube && screen?.phase === 'ready';
  const cubeInspectionSince = cubeReady && inspectionOn ? screen!.readySince : null;
  // For the test cube: the scramble still to make, and the way back to solved.
  useOfferTestCubeMoves(!byCube || !scramble ? [] : [
    { kind: 'scramble', alg: screen?.phase === 'scramble' ? remainingGuide(screen.tokens, screen) : '', grip: settings.frame },
    { kind: 'unscramble', alg: invertAlg(scramble), grip: settings.frame },
  ]);
  // A DNF from the timer screen: the solve stops (before the first turn, with no time).
  const dnf = () => {
    if (timer) stopByHand('dnf');
    else if (scramble) {
      const since = cubeInspectionSince ?? inspecting;
      record(modeHandSolve(mode, scramble, 0, { penalty: 'dnf', ...(since !== null ? { inspectionMs: performance.now() - since } : {}) }));
    }
  };

  // Without one: a tap starts the inspection (when on); then hold, let go, press to stop.
  const tapToInspect = mounted && !byCube && inspectionOn && result === null && inspecting === null && timer === null && scramble !== null;
  const startInspection = useCallback(() => setInspecting(performance.now()), []);
  const hold = useHoldTimer({
    active: mounted && scramble !== null && !byCube && result === null && !tapToInspect,
    state: timer?.by === 'hand' ? 'running' : 'idle',
    pressOnNext: false,
    onStart: () => begin('hand', inspecting === null ? null : performance.now() - inspecting),
    onStop: () => stopByHand(),
    onAbort: () => setTimer(null),
    onNext: () => {},
  });
  useSpacebar(startInspection, tapToInspect);

  const flow = {
    result: result !== null,
    timing: timer !== null,
    inspectionSince: inspecting ?? cubeInspectionSince,
    hold: byCube ? 'idle' as const : hold.phase,
    cubeReady,
  };
  const on = solveScreenOf(flow);

  // The timer screen has the page to itself: the header and the rest step
  // aside (after the hold timer's own effect, so this one has the last word).
  useEffect(() => { setTimerFocus(on === 'timer' && !hidden); }, [on, hold.phase, hidden]);
  useEffect(() => () => setTimerFocus(false), []);

  const cubeRunning = timer?.by === 'cube';
  const abortCube = () => {
    setTimer(null);
    cubeSolve.restart();
  };
  // Stable handlers for the key and app listeners, reading this render's state.
  const latestHandlers = useRef({ stopByHand, abortCube, abandon: () => {} });
  useEffect(() => {
    latestHandlers.current = {
      stopByHand,
      abortCube,
      abandon: cubeRunning ? abortCube : () => { setTimer(null); setInspecting(null); },
    };
  });
  const onSpaceStop = useCallback(() => latestHandlers.current.stopByHand(), []);
  const onEscapeCube = useCallback(() => latestHandlers.current.abortCube(), []);
  const onLeave = useCallback(() => latestHandlers.current.abandon(), []);
  const cancelInspection = useCallback(() => setInspecting(null), []);
  // Space stops a cube solve by hand; Escape abandons it, or the inspection.
  useSpacebar(onSpaceStop, cubeRunning);
  useEscapeKey(onEscapeCube, cubeRunning);
  useEscapeKey(cancelInspection, inspecting !== null && hold.phase === 'idle' && timer === null);
  // Leaving the iOS app abandons the attempt; a connected cube keeps the screen on.
  useNativeTimer(timer !== null || inspecting !== null, onLeave);
  useKeepAwake(connected);

  // Result: Retry keeps the scramble, Next (or Space) brings a new one, Undo
  // takes the solve back and keeps the scramble.
  const retry = useCallback(() => setLatest(null), []);
  const goNext = useCallback(() => {
    setLatest(null);
    next();
  }, [next]);
  const undo = () => {
    if (latest) void deleteSolve(mode, latest.id).catch(() => {});
    setLatest(null);
  };
  // The result shows within the keydown that stopped the timer, so its Space
  // listener would see that same press; it waits for the next one.
  const nextBySpace = useCallback(() => {
    if (performance.now() - stoppedAt.current > 300) goNext();
  }, [goNext]);
  useSpacebar(nextBySpace, on === 'result');

  // One 3D cube for the scramble and timer screens: the scrambled cube
  // without a smart cube; with one, the cube as it is, turning the next
  // move of the guide while scrambling.
  const scrambled = useMemo(() => (scramble ? scrambleState(scramble, settings.frame) : null), [scramble, settings.frame]);
  const guide = byCube && cube.state
    ? { state: cube.state, move: on === 'scramble' && screen ? screen.nextMove : { frame: settings.frame, alg: '' } }
    : scrambled && { state: scrambled, move: { frame: settings.frame, alg: '' } };
  const cubeView = mounted && guide && (
    <VirtualCube practice={null} holding={null} guide={guide} still className="h-full w-full" />
  );

  const rerouted = byCube && screen?.routeKind === 'reroute';
  const tokens = rerouted ? screen!.tokens : scramble?.split(' ') ?? [];
  const done = !byCube || !screen ? null : screen.phase === 'ready' ? tokens.length : screen.routeKind === null ? null : screen.doneTokens;

  const status = byCube && scramble ? cubeSolveStatus(screen, cube.state !== null) : null;

  const records = !hidden && <SolveRecordsButton mode={mode} />;

  if (on === 'result' && result) {
    const moves = modeMoveCount(result);
    const reading = readModeRecord(result);
    return (
      <>
        {records}
        <SolveFrame
          label={t('solve.result.title')}
          cube={cubeView}
          cubeSize="hidden"
          head={(
            <ResultHead
              record={result}
              moves={moves}
              tps={moves === undefined ? null : solveTps(moves, result.ms)}
              crossColour={mode === 'll' ? undefined : reading ? FACE_COLOUR[reading.split.cross] : null}
              onRetry={retry}
              onNext={goNext}
              onUndo={undo}
            />
          )}
          tail={<SolveStages record={result} className="w-full max-w-xl" />}
        />
      </>
    );
  }

  if (on === 'timer') {
    const face = timerFaceOf({ inspectionSince: flow.inspectionSince, hold: flow.hold, timingSince: timer?.since ?? null });
    const withCube = byCube || cubeRunning;
    // With a cube, a press stops the solve by hand. Without one, the press
    // held starts it (the hold timer listens on the window once held, and
    // stops the solve on any press while it runs).
    const press = withCube ? (cubeRunning ? () => stopByHand() : undefined)
      : timer === null ? hold.pressProps.onPointerDown : undefined;
    const label = timer !== null ? t('trainer.tapToStopAria')
      : withCube ? t('solve.cube.timerAria')
        : inspecting !== null ? t('solve.inspection.aria') : t('trainer.hold.aria');
    return (
      <>
        {records}
        <SolveFrame
          label={label}
          onPress={press}
          cube={cubeView}
          cubeSize={withCube ? 'small' : 'hidden'}
          head={<TimerHead face={face} inspectionSince={flow.inspectionSince} />}
          tail={withCube && <DnfButton onDnf={dnf} />}
        />
      </>
    );
  }

  // The scramble screen: without a cube, pressing it starts the inspection
  // (when on) or the press held that starts the timer.
  const press = !mounted || byCube || !scramble ? undefined
    : tapToInspect ? (event: { preventDefault: () => void }) => { event.preventDefault(); startInspection(); }
      : hold.pressProps.onPointerDown;
  return (
    <>
      {records}
      <SolveFrame
        label={t(rerouted ? 'solve.cube.routeTitle' : 'solve.scramble')}
        onPress={press}
        cube={cubeView}
        cubeSize="large"
        head={(
          <ScrambleHead
            toolbar={mounted && <SolveToolbar settings={settings} onNewScramble={next} newDisabled={!scramble} />}
            scramble={scramble}
            failed={failed}
            tokens={tokens}
            done={done}
            undo={byCube && screen?.phase === 'scramble' ? screen.undo : ''}
            rerouted={rerouted}
            status={status && t(status)}
            lines={3}
          />
        )}
      />
    </>
  );
}
