'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useMounted } from '@/hooks/useMounted';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useNativeTimer } from '@/hooks/useNativeTimer';
import { useT } from '@/hooks/useT';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { buildLastLayerSetup, type LastLayerAlgorithm, type LastLayerSetup } from '@/lib/last-layer-setup';
import type { LastLayerPractice } from '@/types/practice';
import type { PracticeSettings } from '@/lib/practice-settings-store';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { formatSeconds } from '@/lib/stats';
import { AUFS } from '@/types/pll';
import { LastLayerPlayer } from './LastLayerPlayer';

type TrainerState = 'idle' | 'running' | 'stopped';
interface Pick<Id> {
  id: Id;
  setup: LastLayerSetup;
  settings: PracticeSettings;
}
interface Props<Id extends string> {
  practice: LastLayerPractice;
  ids: readonly Id[];
  selected: Set<Id>;
  algorithmFor: (id: Id) => LastLayerAlgorithm;
  nameFor: (id: Id) => string;
  lastRecorded: Map<Id, number>;
  add: (id: Id, seconds: number) => void;
  bestFor: (id: Id) => number | null;
  ao5For: (id: Id) => number | null;
  solvesFor: (id: Id) => unknown[];
}

export function LastLayerRandomTrainer<Id extends string>({
  practice, ids, selected, algorithmFor, nameFor, lastRecorded, add, bestFor, ao5For, solvesFor,
}: Props<Id>) {
  const { t, tn } = useT();
  const { settings } = usePracticeSettings();
  const [state, setState] = useState<TrainerState>('idle');
  const [current, setCurrent] = useState<Pick<Id> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mounted = useMounted();
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Snapshot the solution, settings and random offset together. The scramble
  // remains identical from the setup screen through recording the solve.
  const pickRandom = useCallback((): Pick<Id> => {
    const pool = ids.filter((id) => selected.has(id));
    const id = pickStaleWeighted(pool.length ? pool : ids, (id) => lastRecorded.get(id), Date.now());
    const offset = settings.randomAuf ? AUFS[Math.floor(Math.random() * AUFS.length)] : 'U0';
    return { id, setup: buildLastLayerSetup(algorithmFor(id), settings.aufDisplay, offset), settings };
  }, [ids, selected, lastRecorded, settings, algorithmFor]);

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
  if (mounted && state === 'idle' && settings.trainerMode === 'inverse' && !noneSelected &&
      (!current || !selected.has(current.id) || current.settings !== settings)) {
    setCurrent(pickRandom());
  }

  const start = useCallback(() => {
    if (!mounted || noneSelected) return;
    if (settings.trainerMode !== 'inverse' || !current) setCurrent(pickRandom());
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, [pickRandom, mounted, noneSelected, settings.trainerMode, current]);

  const stop = useCallback(() => {
    setElapsed((Date.now() - startRef.current) / 1000);
    setState('stopped');
  }, []);

  useNativeTimer(state === 'running', stop);

  const record = useCallback(() => {
    if (current && elapsed > 0) add(current.id, elapsed);
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
    // Random-trainer history for this case so far (the time on screen is not
    // recorded yet).
    const previousSolves = solvesFor(current.id).length;
    return (
      <div className="w-full flex-1 rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900">
            <LastLayerPlayer practice={practice} setupAlg={current.setup.scramble} size={220} />
          </div>
          <div className="text-center sm:text-left">
            <div className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {nameFor(current.id)}
            </div>
            <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {elapsed.toFixed(3)}
            </div>
            {previousSolves > 0 && (
              <div className="mt-1 text-xs font-mono text-amber-700/80 dark:text-amber-300/80">
                {t('detail.randomStats', {
                  best: formatSeconds(bestFor(current.id)),
                  ao5: formatSeconds(ao5For(current.id)),
                  solves: tn('common.solves', previousSolves),
                })}
              </div>
            )}
          </div>
        </div>
        <div className="max-w-2xl w-full text-center font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">
          <p>
            {current.settings.aufDisplay === 'prefix' ? current.setup.solution : <>
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

  if (settings.trainerMode === 'inverse') {
    return (
      <button
        type="button"
        onPointerDown={start}
        className="w-full flex-1 min-h-[200px] rounded-lg flex flex-col items-center justify-center gap-4 px-6 transition-colors select-none touch-none bg-emerald-500 hover:bg-emerald-600 text-white"
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
        <div className="text-xs opacity-75">
          {mounted && t('trainer.selectedCount', { count: selected.size, total: ids.length })}
        </div>
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
      <div className="text-xs opacity-75">
        {mounted && t('trainer.selectedCount', { count: selected.size, total: ids.length })}
      </div>
    </button>
  );
}
