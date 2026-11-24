'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useF2LRandomSelection } from '@/hooks/useF2LRandomSelection';
import { useF2LRandomSolves } from '@/hooks/useF2LRandomSolves';
import { useMounted } from '@/hooks/useMounted';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useNativeTimer } from '@/hooks/useNativeTimer';
import { recordSmartSolve, useSmartCubeTrainer, type SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { useNoScrambleTrainer } from '@/hooks/useNoScrambleTrainer';
import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import { useTrainerMode } from '@/hooks/useTrainerMode';
import { useT } from '@/hooks/useT';
import { combineAuf, invertAuf, prefixAuf } from '@/lib/f2l-auf';
import { buildF2LSetup, seededRandom } from '@/lib/f2l-scramble';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { deleteSmartSolve } from '@/lib/smart-solve-store';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import { F2L_IDS, type F2LAlgorithmRecord, type F2LId } from '@/types/f2l';
import type { Auf } from '@/types/pll';
import { F2L3DPlayer } from './F2L3DPlayer';
import { SmartCubeSetupStatus, SmartCubeSetupTokens } from './SmartCubeSetupGuide';
import { SmartSolveSummary } from './SmartSolveHistory';
import { NoScrambleStage } from './NoScrambleStage';

type TrainerState = 'idle' | 'running' | 'stopped';

interface F2LTrainerProps {
  ids: readonly F2LId[];
  selected: ReadonlySet<F2LId>;
  // Epoch ms of each case's most recent solve, driving the staleness-weighted
  // draw: cases timed longest ago (or never) surface more often.
  lastRecorded: Map<F2LId, number>;
  /** The algorithm a case is set up and shown with; null falls back to speedcubedb's primary. */
  algorithmFor: (id: F2LId) => { auf: Auf; algorithm: string } | null;
  /** Records a time; returns its id (for undo), or null when nothing was recorded. */
  add: (id: F2LId, seconds: number) => string | null;
  remove: (solveId: string) => void;
  bestFor: (id: F2LId) => number | null;
  ao5For: (id: F2LId) => number | null;
  solvesFor: (id: F2LId) => unknown[];
  /** Case practice: one case, recorded to one algorithm, so no selection note. */
  single?: boolean;
}

// Random F2L practice: the cases ticked in the grid, timed into the random
// solves, with the starred algorithms.
export function F2LRandomTrainer() {
  const solves = useF2LRandomSolves();
  const { starredFor } = useF2LAlgorithms();
  const { selected } = useF2LRandomSelection();
  const lastRecorded = useMemo(() => {
    const map = new Map<F2LId, number>();
    for (const s of solves.all) {
      const ts = Date.parse(s.recordedAt);
      if (Number.isNaN(ts)) continue;
      const prev = map.get(s.f2lId);
      if (prev === undefined || ts > prev) map.set(s.f2lId, ts);
    }
    return map;
  }, [solves.all]);
  return (
    <F2LTrainer
      ids={F2L_IDS} selected={selected} lastRecorded={lastRecorded} algorithmFor={starredFor}
      add={solves.add} remove={solves.remove} bestFor={solves.bestFor} ao5For={solves.ao5For} solvesFor={solves.solvesFor}
    />
  );
}

// Practice of one algorithm from its case page: the same trainer with a
// single case, timed into that algorithm's times.
export function F2LCaseTrainer({ record }: { record: F2LAlgorithmRecord }) {
  const { addTime, removeTime } = useF2LAlgorithms();
  const { id, f2lId, auf, algorithm, times } = record;
  const ids = useMemo(() => [f2lId], [f2lId]);
  const selected = useMemo(() => new Set([f2lId]), [f2lId]);
  const lastRecorded = useMemo(() => new Map<F2LId, number>(), []);
  const algorithmFor = useCallback(() => ({ auf, algorithm }), [auf, algorithm]);
  return (
    <F2LTrainer
      ids={ids} selected={selected} lastRecorded={lastRecorded} algorithmFor={algorithmFor} single
      add={(_case, seconds) => addTime(id, seconds)}
      remove={(timeId) => removeTime(id, timeId)}
      bestFor={() => bestSeconds(times)} ao5For={() => averageOfN(times, 5)} solvesFor={() => times}
    />
  );
}

export function F2LTrainer({
  ids, selected, lastRecorded, algorithmFor, add, remove, bestFor, ao5For, solvesFor, single = false,
}: F2LTrainerProps) {
  const { t, tn } = useT();
  const { settings: scrambleSettings } = usePracticeSettings();
  const { aufDisplay: aufMode } = scrambleSettings;
  // Fixed when the practice started: no setup runs on the virtual cube when a
  // smart cube was connected, and as the tap timer otherwise.
  const mode = useTrainerMode();
  const noScramble = mode === 'no-scramble';
  const inverse = mode === 'inverse';
  // Both inverse and no-scramble show the case before timing, so draw it ahead.
  const drawAhead = inverse || noScramble;
  const [state, setState] = useState<TrainerState>('idle');
  const [current, setCurrent] = useState<F2LId | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Seed for the current case's setup (scramble and orientation offset);
  // drawn with the case so the setup is stable across re-renders but
  // different on every draw.
  const [setupSeed, setSetupSeed] = useState(0);
  const mounted = useMounted();
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // The solve the smart cube timed, if any; read when the time is recorded.
  const smartSolveRef = useRef<SmartSolve | null>(null);
  // No-scramble without a connected cube has nothing to solve, so Space waits.
  const startBlockedRef = useRef(false);

  // Draw only from the selected cases. Falls back to all of `ids` if nothing
  // is selected (shouldn't happen — start is disabled). Also returns a fresh
  // seed for the case's setup.
  const pickRandom = useCallback((): { id: F2LId; seed: number } => {
    const pool = ids.filter((id) => selected.has(id));
    const list = pool.length > 0 ? pool : ids;
    return {
      id: pickStaleWeighted(list, (id) => lastRecorded.get(id), Date.now()),
      seed: Math.floor(Math.random() * 0x7fffffff),
    };
  }, [ids, selected, lastRecorded]);

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
  if (mounted && state === 'idle' && drawAhead && current === null && !noneSelected) {
    const next = pickRandom();
    setCurrent(next.id);
    setSetupSeed(next.seed);
  }

  const start = useCallback(() => {
    // Inverse mode times the case already shown on the start screen; standard
    // mode draws one now.
    if (drawAhead && current) {
      setCurrent(current);
    } else {
      const next = pickRandom();
      setCurrent(next.id);
      setSetupSeed(next.seed);
    }
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, [pickRandom, drawAhead, current]);

  const stop = useCallback(() => {
    setElapsed((Date.now() - startRef.current) / 1000);
    setState('stopped');
  }, []);

  // Stop with a time measured elsewhere (the smart cube's clock).
  const stopWith = useCallback((seconds: number) => {
    setElapsed(seconds);
    setState('stopped');
  }, []);

  const record = useCallback(() => {
    if (current && elapsed > 0) {
      add(current, elapsed);
      if (smartSolveRef.current) recordSmartSolve(smartSolveRef.current, current);
    }
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  }, [current, elapsed, add]);

  const discard = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  }, []);

  // Abandon the attempt but keep the case (no-scramble reset while timing).
  const abort = useCallback(() => {
    setState('idle');
    setElapsed(0);
  }, []);


  // Everything the three case screens need, derived once from the drawn case
  // and its seed. The given algorithm (the starred one in random practice)
  // wins; the speedcubedb primary (which carries its own AUF as a leading
  // turn) is the fallback.
  const shown = useMemo(() => {
    if (!current) return null;
    const def = getF2LDefinition(current);
    const star = algorithmFor(current);
    const auf: Auf = star?.auf ?? 'U0';
    const body = star?.algorithm ?? def?.primaryAlg ?? '';
    const setup = buildF2LSetup(current, { auf, body }, scrambleSettings, seededRandom(setupSeed));
    // The U turn needed from the shown orientation before the body.
    const effectiveAuf = combineAuf(invertAuf(setup.uOffset), auf);
    return { def, star, auf, body, setup, effectiveAuf };
  }, [current, algorithmFor, scrambleSettings, setupSeed]);

  // With a smart cube connected, inverse mode follows the setup on the cube
  // and starts and stops the timer by itself; without one this is null.
  const smart = useSmartCubeTrainer({
    practice: 'f2l',
    scramble: inverse && shown ? shown.setup.scramble : null,
    trainerState: state,
    onStart: start,
    onStop: (seconds) => (seconds === null ? stop() : stopWith(seconds)),
  });
  // No-scramble: the case on a virtual cube, moved by the smart cube's turns.
  // Solves are recorded as they stop; the next case follows on Next, or by
  // itself once the cube rests when auto-advance is on.
  const { autoAdvance } = useSmartCubeSettings();
  const virtual = useNoScrambleTrainer({
    active: noScramble,
    autoAdvance,
    practice: 'f2l',
    scramble: shown ? shown.setup.scramble : null,
    trainerState: state,
    describe: () => shown && current && {
      caseId: current,
      name: shown.def ? t('common.f2lCase', { number: shown.def.number }) : current,
      solution: shown.star
        ? prefixAuf(shown.effectiveAuf, shown.star.algorithm)
        : shown.def ? prefixAuf(invertAuf(shown.setup.uOffset), shown.def.primaryAlg) : '',
    },
    record: (caseId, seconds, solve) => {
      const solveId = add(caseId as F2LId, seconds);
      const smartId = solve ? recordSmartSolve(solve, caseId) : null;
      if (!solveId && !smartId) return null;
      return () => {
        if (solveId) remove(solveId);
        if (smartId) void deleteSmartSolve(smartId);
      };
    },
    onStart: start,
    onStop: (seconds) => {
      const settled = seconds ?? (Date.now() - startRef.current) / 1000;
      stopWith(settled);
      return settled;
    },
    onAbort: abort,
    onAdvance: discard,
  });
  // Leaving the app abandons a no-scramble attempt (it is recorded on its own otherwise).
  useNativeTimer(state === 'running', noScramble ? virtual.reset : stop);
  // Keyboard: Space mirrors the tap action (idle → start, running → stop) and
  // records on the result screen; Escape discards there. In no-scramble mode
  // the solve is already recorded, so Space goes on and Escape takes it back.
  const latest = virtual.results[0];
  const onSpace = useCallback(() => {
    if (state === 'idle') {
      if (!noneSelected && !startBlockedRef.current) start();
    } else if (state === 'running') {
      if (noScramble) virtual.stopByHand();
      else stop();
    } else if (noScramble) virtual.next();
    else record();
  }, [state, start, stop, record, noneSelected, noScramble, virtual]);
  useSpacebar(onSpace);
  useEscapeKey(
    noScramble ? () => { if (latest && !latest.undone) virtual.undo(latest.key); } : discard,
    state === 'stopped',
  );

  const solve = smart?.solve ?? virtual.view?.solve ?? null;
  const recognitionMs = smart?.recognitionMs ?? virtual.view?.recognitionMs ?? null;
  useEffect(() => {
    smartSolveRef.current = solve;
    startBlockedRef.current = noScramble && !virtual.connected;
  });

  const player = (className: string) =>
    shown && (
      <F2L3DPlayer
        algorithm={shown.body}
        setupAlg={shown.def?.setupAlg ?? ''}
        auf={shown.auf}
        uOffset={shown.setup.uOffset}
        interactive={false}
        className={className}
      />
    );

  // The result screen's content, shared by the standard/inverse layout and
  // the no-scramble one.
  const previousSolves = current ? solvesFor(current).length : 0;
  const resultInfo = shown && current && (
    <div className="text-center sm:text-left">
      <div className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
        {shown.def ? t('common.f2lCase', { number: shown.def.number }) : current}
      </div>
      <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
        {elapsed.toFixed(3)}
      </div>
      {previousSolves > 0 && (
        <div className="mt-1 text-xs font-mono text-amber-700/80 dark:text-amber-300/80">
          {t(single ? 'detail.caseStats' : 'detail.randomStats', {
            best: formatSeconds(bestFor(current)),
            ao5: formatSeconds(ao5For(current)),
            solves: tn('common.solves', previousSolves),
          })}
        </div>
      )}
      {recognitionMs != null && (
        <div className="mt-1 text-xs font-mono text-amber-700/80 dark:text-amber-300/80">
          {t('smartCube.trainer.recognition', { seconds: (recognitionMs / 1000).toFixed(2) })}
        </div>
      )}
    </div>
  );
  const resultRest = shown && current && (
    <>
      <div className="max-w-2xl w-full text-center font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">
        {shown.star ? (
          aufMode === 'cube' ? (
            <p>
              <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
                {shown.effectiveAuf}
              </span>
              {shown.star.algorithm}
            </p>
          ) : (
            <p>{prefixAuf(shown.effectiveAuf, shown.star.algorithm)}</p>
          )
        ) : shown.def ? (
          <p className="text-zinc-500">
            {prefixAuf(invertAuf(shown.setup.uOffset), shown.def.primaryAlg)}
          </p>
        ) : (
          <p className="italic text-zinc-500">{t('trainer.f2l.noAlgorithm')}</p>
        )}
      </div>
      {solve && <SmartSolveSummary solve={solve} />}
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

  const selectedNote = mounted && !single
    ? t('trainer.selectedCount', { count: selected.size, total: ids.length })
    : '';

  if (noScramble && !noneSelected) {
    return (
      <NoScrambleStage
        state={state}
        trainer={virtual}
        elapsed={elapsed}
        selectedNote={selectedNote}
      />
    );
  }

  if (state === 'stopped' && shown && current) {
    return (
      <div className="w-full flex-1 rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900 w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]">
            {player('w-full h-full')}
          </div>
          {resultInfo}
        </div>
        {resultRest}
      </div>
    );
  }

  if (state === 'running' && shown) {
    return (
      <button
        type="button"
        onPointerDown={stop}
        className="w-full flex-1 min-h-[280px] rounded-lg flex flex-col items-center justify-center gap-4 sm:gap-8 transition-colors select-none touch-none bg-rose-500 hover:bg-rose-600 text-white"
        aria-label={t('trainer.tapToStopAria')}
      >
        <div className="rounded-md p-2 bg-white/15 w-[180px] h-[180px] sm:w-[260px] sm:h-[260px]">
          {player('w-full h-full')}
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
        {smart && <div className="text-xs opacity-80">{t('smartCube.trainer.autoStop')}</div>}
      </button>
    );
  }

  if (noneSelected) {
    return (
      <div className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-2 select-none bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
        <div className="text-sm font-medium uppercase tracking-wider">
          {t('trainer.noneSelected')}
        </div>
        <div className="text-xs">{t('trainer.f2l.tickOne')}</div>
      </div>
    );
  }

  // Inverse mode shows the setup scramble right on the start button, so the
  // user can bring their cube into the case before timing.
  if (inverse) {
    return (
      <button
        type="button"
        onPointerDown={start}
        className={`w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-4 px-6 transition-colors select-none touch-none text-white ${
          smart?.phase === 'ready' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-emerald-500 hover:bg-emerald-600'
        }`}
        aria-label={t('trainer.tapToStartAria')}
      >
        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
          {t(smart ? 'smartCube.trainer.turn' : 'trainer.applyToCube')}
        </div>
        <div className="max-w-2xl w-full text-center font-mono text-3xl sm:text-4xl font-bold break-words leading-snug">
          {smart ? <SmartCubeSetupTokens view={smart} /> : shown?.setup.scramble || '…'}
        </div>
        {smart && <SmartCubeSetupStatus view={smart} practice="f2l" />}
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
