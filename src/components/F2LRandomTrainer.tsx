'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import { useF2LRandomSelection } from '@/hooks/useF2LRandomSelection';
import { useF2LRandomSolves } from '@/hooks/useF2LRandomSolves';
import { useF2LTrainerMode } from '@/hooks/useF2LTrainerMode';
import { prefixAuf } from '@/lib/f2l-auf';
import { invertAlg } from '@/lib/invert-alg';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { useSpacebar } from '@/hooks/useSpacebar';
import { F2L_IDS, type F2LId } from '@/types/f2l';
import { F2L3DPlayer } from './F2L3DPlayer';

type TrainerState = 'idle' | 'setup' | 'running' | 'stopped';

export function F2LRandomTrainer() {
  const { add, all } = useF2LRandomSolves();
  const { starredFor } = useF2LAlgorithms();
  const { selected } = useF2LRandomSelection();
  const { mode: aufMode } = useF2LAufDisplay();
  const { mode: trainerMode } = useF2LTrainerMode();
  const [state, setState] = useState<TrainerState>('idle');
  const [current, setCurrent] = useState<F2LId | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mounted, setMounted] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  // Epoch ms of each case's most recent solve, driving the staleness-weighted
  // draw below — cases timed longest ago (or never) surface more often.
  const lastRecorded = useMemo(() => {
    const map = new Map<F2LId, number>();
    for (const s of all) {
      const t = Date.parse(s.recordedAt);
      if (Number.isNaN(t)) continue;
      const prev = map.get(s.f2lId);
      if (prev === undefined || t > prev) map.set(s.f2lId, t);
    }
    return map;
  }, [all]);

  // Draw only from the cases the user ticked in the grid below. Falls back to
  // the full set if nothing is selected (shouldn't happen — start is disabled).
  const pickRandom = useCallback((): F2LId => {
    const pool = F2L_IDS.filter((id) => selected.has(id));
    const list = pool.length > 0 ? pool : F2L_IDS;
    return pickStaleWeighted(list, (id) => lastRecorded.get(id), Date.now());
  }, [selected, lastRecorded]);

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

  // Begin timing the current case. Shared by the standard flow (straight from
  // idle) and the inverse flow (after the setup screen).
  const begin = useCallback(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, []);

  const start = useCallback(() => {
    setCurrent(pickRandom());
    setElapsed(0);
    // Inverse mode shows the scramble first; standard mode times immediately.
    if (trainerMode === 'inverse') {
      setState('setup');
    } else {
      startRef.current = Date.now();
      setState('running');
    }
  }, [pickRandom, trainerMode]);

  const stop = useCallback(() => {
    setElapsed((Date.now() - startRef.current) / 1000);
    setState('stopped');
  }, []);

  const record = () => {
    if (current && elapsed > 0) add(current, elapsed);
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  };

  const discard = () => {
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  };

  const onSpace = useCallback(() => {
    if (state === 'idle') {
      if (!noneSelected) start();
    } else if (state === 'setup') {
      begin();
    } else if (state === 'running') stop();
  }, [state, start, begin, stop, noneSelected]);
  useSpacebar(onSpace);

  if (state === 'stopped' && current) {
    const def = getF2LDefinition(current);
    const star = starredFor(current);
    const alg = star?.algorithm ?? def?.primaryAlg ?? '';
    const setupAlg = def?.setupAlg ?? '';
    return (
      <div className="w-full flex-1 rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900 w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]">
            <F2L3DPlayer
              algorithm={alg}
              setupAlg={setupAlg}
              auf={star?.auf ?? 'U0'}
              interactive={false}
              className="w-full h-full"
            />
          </div>
          <div className="text-center sm:text-left">
            <div className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
              F2L {def?.number ?? current}
            </div>
            <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {elapsed.toFixed(3)}
            </div>
          </div>
        </div>
        <div className="max-w-2xl w-full text-center font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">
          {star ? (
            aufMode === 'cube' ? (
              <p>
                <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
                  {star.auf}
                </span>
                {star.algorithm}
              </p>
            ) : (
              <p>{prefixAuf(star.auf, star.algorithm)}</p>
            )
          ) : def ? (
            <p className="text-zinc-500">{def.primaryAlg}</p>
          ) : (
            <p className="italic text-zinc-500">No algorithm saved for this case</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={record}
            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 font-semibold"
          >
            ✓ Record
          </button>
          <button
            type="button"
            onClick={discard}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✗ Discard
          </button>
        </div>
      </div>
    );
  }

  if (state === 'setup' && current) {
    const def = getF2LDefinition(current);
    const star = starredFor(current);
    const alg = star?.algorithm ?? def?.primaryAlg ?? '';
    const auf = star?.auf ?? 'U0';
    // Inverse of the full solving sequence (AUF + algorithm): applying it to a
    // solved cube reproduces the case the algorithm solves.
    const scramble = invertAlg(prefixAuf(auf, alg));
    return (
      <div className="w-full flex-1 min-h-[280px] rounded-lg border border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="text-sm font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">
          Apply this to your cube
        </div>
        <div className="max-w-2xl w-full text-center font-mono text-2xl sm:text-3xl font-bold break-words text-sky-800 dark:text-sky-200">
          {scramble || '—'}
        </div>
        <div className="text-xs text-zinc-500 text-center">
          Inverse of the algorithm — run it from a solved cube to reach the case.
        </div>
        <button
          type="button"
          onClick={begin}
          className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 font-semibold"
        >
          START
        </button>
        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          Tap START or Space to begin timing
        </div>
      </div>
    );
  }

  if (state === 'running' && current) {
    const def = getF2LDefinition(current);
    const star = starredFor(current);
    const alg = star?.algorithm ?? def?.primaryAlg ?? '';
    const setupAlg = def?.setupAlg ?? '';
    return (
      <button
        type="button"
        onPointerDown={stop}
        className="w-full flex-1 min-h-[280px] rounded-lg flex flex-col items-center justify-center gap-4 sm:gap-8 transition-colors select-none touch-none bg-rose-500 hover:bg-rose-600 text-white"
        aria-label="Tap to stop the timer"
      >
        <div className="rounded-md p-2 bg-white/15 w-[180px] h-[180px] sm:w-[260px] sm:h-[260px]">
          <F2L3DPlayer
            algorithm={alg}
            setupAlg={setupAlg}
            auf={star?.auf ?? 'U0'}
            interactive={false}
            className="w-full h-full"
          />
        </div>
        <div
          className="font-mono text-6xl sm:text-8xl font-bold tabular-nums leading-none"
          aria-live="polite"
        >
          {elapsed.toFixed(3)}
        </div>
        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
          Tap or Space to stop
        </div>
      </button>
    );
  }

  if (noneSelected) {
    return (
      <div className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-2 select-none bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
        <div className="text-sm font-medium uppercase tracking-wider">
          No cases selected
        </div>
        <div className="text-xs">
          Tick at least one F2L case on the list to start the trainer
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={start}
      className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-3 transition-colors select-none touch-none bg-emerald-500 hover:bg-emerald-600 text-white"
      aria-label="Tap to start the random F2L trainer"
    >
      <div className="font-mono text-6xl sm:text-8xl font-bold tabular-nums leading-none">
        0.000
      </div>
      <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
        Tap or Space to start
      </div>
      <div className="text-xs opacity-75">
        {trainerMode === 'inverse'
          ? 'Scramble your cube with the inverse algorithm, then time your solve'
          : 'A random F2L case appears — number hidden until you stop'}
        {mounted && ` · ${selected.size}/${F2L_IDS.length} selected`}
      </div>
    </button>
  );
}
