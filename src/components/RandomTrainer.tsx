'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useMounted } from '@/hooks/useMounted';
import { usePllRandomSelection } from '@/hooks/usePllRandomSelection';
import { useRandomSolves } from '@/hooks/useRandomSolves';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useT } from '@/hooks/useT';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { formatSeconds } from '@/lib/stats';
import { PLL_IDS, type Auf, type PllId } from '@/types/pll';
import { PllLLView } from './PllLLView';

type TrainerState = 'idle' | 'running' | 'stopped';

interface Pick {
  pllId: PllId;
  auf: Auf;
}

export function RandomTrainer() {
  const { t, tn } = useT();
  const { add, all, bestFor, ao5For, solvesFor } = useRandomSolves();
  const { starredFor } = useAlgorithms();
  const { selected } = usePllRandomSelection();
  const [state, setState] = useState<TrainerState>('idle');
  const [current, setCurrent] = useState<Pick | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mounted = useMounted();
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Epoch ms of each PLL's most recent solve, driving the staleness-weighted
  // draw below — cases timed longest ago (or never) surface more often.
  const lastRecorded = useMemo(() => {
    const map = new Map<PllId, number>();
    for (const s of all) {
      const ts = Date.parse(s.recordedAt);
      if (Number.isNaN(ts)) continue;
      const prev = map.get(s.pllId);
      if (prev === undefined || ts > prev) map.set(s.pllId, ts);
    }
    return map;
  }, [all]);

  // AUF for the picked PLL comes from its starred algorithm in All PLLs mode,
  // so the random case is presented in the orientation the user actually
  // practices. Falls back to U0 if no algorithm is starred for that PLL.
  // Only the cases ticked in the grid below are eligible (full set as a
  // fallback when nothing is selected — start is disabled in that case).
  const pickRandom = useCallback((): Pick => {
    const pool = PLL_IDS.filter((id) => selected.has(id));
    const list = pool.length > 0 ? pool : PLL_IDS;
    const pllId = pickStaleWeighted(list, (id) => lastRecorded.get(id), Date.now());
    const auf = starredFor(pllId)?.auf ?? 'U0';
    return { pllId, auf };
  }, [starredFor, selected, lastRecorded]);

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

  const record = useCallback(() => {
    if (current && elapsed > 0) add(current.pllId, elapsed);
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  }, [current, elapsed, add]);

  const discard = useCallback(() => {
    setState('idle');
    setElapsed(0);
    setCurrent(null);
  }, []);

  // Keyboard: Space mirrors the tap action (idle → start, running → stop) and
  // records on the result screen; Escape discards there.
  const onSpace = useCallback(() => {
    if (state === 'idle') {
      if (!noneSelected) start();
    } else if (state === 'running') stop();
    else record();
  }, [state, start, stop, record, noneSelected]);
  useSpacebar(onSpace);
  useEscapeKey(discard, state === 'stopped');

  if (state === 'stopped' && current) {
    const def = getPllDefinition(current.pllId);
    const star = starredFor(current.pllId);
    // Random-trainer history for this case so far (the time on screen is not
    // recorded yet).
    const previousSolves = solvesFor(current.pllId).length;
    return (
      <div className="w-full flex-1 rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900">
            <PllLLView pllId={current.pllId} auf={current.auf} size={220} />
          </div>
          <div className="text-center sm:text-left">
            <div className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {def?.name ?? current.pllId} · {current.auf}
            </div>
            <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {elapsed.toFixed(3)}
            </div>
            {previousSolves > 0 && (
              <div className="mt-1 text-xs font-mono text-amber-700/80 dark:text-amber-300/80">
                {t('detail.randomStats', {
                  best: formatSeconds(bestFor(current.pllId)),
                  ao5: formatSeconds(ao5For(current.pllId)),
                  solves: tn('common.solves', previousSolves),
                })}
              </div>
            )}
          </div>
        </div>
        <div className="max-w-2xl w-full text-center font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">
          {star ? (
            <p>
              <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
                {star.auf}
              </span>
              {star.algorithm}
            </p>
          ) : (
            <p className="italic text-zinc-500">{t('trainer.pll.noStar')}</p>
          )}
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
          <PllLLView pllId={current.pllId} auf={current.auf} size={220} />
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
        <div className="text-xs">{t('trainer.pll.tickOne')}</div>
      </div>
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
      <div className="text-xs opacity-75">
        {t('trainer.pll.hidden')}
        {mounted &&
          ` · ${t('trainer.selectedCount', { count: selected.size, total: PLL_IDS.length })}`}
      </div>
    </button>
  );
}
