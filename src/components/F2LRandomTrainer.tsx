'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useF2LRandomSolves } from '@/hooks/useF2LRandomSolves';
import { useSpacebar } from '@/hooks/useSpacebar';
import { F2L_IDS, type F2LId } from '@/types/f2l';
import { F2L3DPlayer } from './F2L3DPlayer';

type TrainerState = 'idle' | 'running' | 'stopped';

export function F2LRandomTrainer() {
  const { add } = useF2LRandomSolves();
  const { starredFor } = useF2LAlgorithms();
  const [state, setState] = useState<TrainerState>('idle');
  const [current, setCurrent] = useState<F2LId | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const pickRandom = useCallback((): F2LId => {
    return F2L_IDS[Math.floor(Math.random() * F2L_IDS.length)];
  }, []);

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

  const start = useCallback(() => {
    setCurrent(pickRandom());
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, [pickRandom]);

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
    if (state === 'idle') start();
    else if (state === 'running') stop();
  }, [state, start, stop]);
  useSpacebar(onSpace);

  if (state === 'stopped' && current) {
    const def = getF2LDefinition(current);
    const star = starredFor(current);
    const alg = star?.algorithm ?? def?.primaryAlg ?? '';
    const setupAlg = def?.setupAlg ?? '';
    return (
      <div className="rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center gap-4 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900 w-[200px] h-[200px]">
            <F2L3DPlayer
              algorithm={alg}
              setupAlg={setupAlg}
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
            <p>{star.algorithm}</p>
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

  if (state === 'running' && current) {
    const def = getF2LDefinition(current);
    const star = starredFor(current);
    const alg = star?.algorithm ?? def?.primaryAlg ?? '';
    const setupAlg = def?.setupAlg ?? '';
    return (
      <button
        type="button"
        onPointerDown={stop}
        className="w-full min-h-[280px] rounded-lg flex flex-col items-center justify-center gap-4 transition-colors select-none touch-none bg-rose-500 hover:bg-rose-600 text-white"
        aria-label="Tap to stop the timer"
      >
        <div className="rounded-md p-2 bg-white/15 w-[180px] h-[180px]">
          <F2L3DPlayer
            algorithm={alg}
            setupAlg={setupAlg}
            interactive={false}
            className="w-full h-full"
          />
        </div>
        <div
          className="font-mono text-5xl sm:text-6xl font-bold tabular-nums leading-none"
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

  return (
    <button
      type="button"
      onPointerDown={start}
      className="w-full min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-3 transition-colors select-none touch-none bg-emerald-500 hover:bg-emerald-600 text-white"
      aria-label="Tap to start the random F2L trainer"
    >
      <div className="font-mono text-5xl sm:text-6xl font-bold tabular-nums leading-none">
        0.000
      </div>
      <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
        Tap or Space to start
      </div>
      <div className="text-xs opacity-75">
        A random F2L case appears — number hidden until you stop
      </div>
    </button>
  );
}
