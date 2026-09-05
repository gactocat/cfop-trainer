'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import { useF2LRandomSelection } from '@/hooks/useF2LRandomSelection';
import { useF2LRandomSolves } from '@/hooks/useF2LRandomSolves';
import { useF2LScrambleSettings } from '@/hooks/useF2LScrambleSettings';
import { useF2LTrainerMode } from '@/hooks/useF2LTrainerMode';
import { useMounted } from '@/hooks/useMounted';
import { useSpacebar } from '@/hooks/useSpacebar';
import { useT } from '@/hooks/useT';
import { combineAuf, invertAuf, prefixAuf } from '@/lib/f2l-auf';
import { buildF2LSetup, seededRandom } from '@/lib/f2l-scramble';
import { pickStaleWeighted } from '@/lib/stale-weighted-pick';
import { F2L_IDS, type F2LId } from '@/types/f2l';
import type { Auf } from '@/types/pll';
import { F2L3DPlayer } from './F2L3DPlayer';

type TrainerState = 'idle' | 'running' | 'stopped';

export function F2LRandomTrainer() {
  const { t } = useT();
  const { add, all } = useF2LRandomSolves();
  const { starredFor } = useF2LAlgorithms();
  const { selected } = useF2LRandomSelection();
  const { mode: aufMode } = useF2LAufDisplay();
  const { mode: trainerMode } = useF2LTrainerMode();
  const { settings: scrambleSettings } = useF2LScrambleSettings();
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

  // Epoch ms of each case's most recent solve, driving the staleness-weighted
  // draw below — cases timed longest ago (or never) surface more often.
  const lastRecorded = useMemo(() => {
    const map = new Map<F2LId, number>();
    for (const s of all) {
      const ts = Date.parse(s.recordedAt);
      if (Number.isNaN(ts)) continue;
      const prev = map.get(s.f2lId);
      if (prev === undefined || ts > prev) map.set(s.f2lId, ts);
    }
    return map;
  }, [all]);

  // Draw only from the cases the user ticked in the grid below. Falls back to
  // the full set if nothing is selected (shouldn't happen — start is disabled).
  // Also returns a fresh seed for the case's setup.
  const pickRandom = useCallback((): { id: F2LId; seed: number } => {
    const pool = F2L_IDS.filter((id) => selected.has(id));
    const list = pool.length > 0 ? pool : F2L_IDS;
    return {
      id: pickStaleWeighted(list, (id) => lastRecorded.get(id), Date.now()),
      seed: Math.floor(Math.random() * 0x7fffffff),
    };
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

  // In inverse mode the start screen shows the scramble, so a case is drawn as
  // soon as the trainer is idle without one (first client render, after each
  // solve, or when the mode is switched); standard mode draws on start. This is
  // the "adjust state during render" pattern: React re-renders immediately with
  // the new state. Gated on `mounted` so the server markup stays deterministic.
  if (mounted && state === 'idle' && trainerMode === 'inverse' && current === null && !noneSelected) {
    const next = pickRandom();
    setCurrent(next.id);
    setSetupSeed(next.seed);
  }

  const start = useCallback(() => {
    // Inverse mode times the case already shown on the start screen; standard
    // mode draws one now.
    if (trainerMode === 'inverse' && current) {
      setCurrent(current);
    } else {
      const next = pickRandom();
      setCurrent(next.id);
      setSetupSeed(next.seed);
    }
    startRef.current = Date.now();
    setElapsed(0);
    setState('running');
  }, [pickRandom, trainerMode, current]);

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
    } else if (state === 'running') stop();
  }, [state, start, stop, noneSelected]);
  useSpacebar(onSpace);

  // Everything the three case screens need, derived once from the drawn case
  // and its seed. The starred algorithm wins; the speedcubedb primary (which
  // carries its own AUF as a leading turn) is the fallback.
  const shown = useMemo(() => {
    if (!current) return null;
    const def = getF2LDefinition(current);
    const star = starredFor(current);
    const auf: Auf = star?.auf ?? 'U0';
    const body = star?.algorithm ?? def?.primaryAlg ?? '';
    const setup = buildF2LSetup(current, { auf, body }, scrambleSettings, seededRandom(setupSeed));
    // The U turn needed from the shown orientation before the body.
    const effectiveAuf = combineAuf(invertAuf(setup.uOffset), auf);
    return { def, star, auf, body, setup, effectiveAuf };
  }, [current, starredFor, scrambleSettings, setupSeed]);

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

  if (state === 'stopped' && shown) {
    return (
      <div className="w-full flex-1 rounded-lg border border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6 flex flex-col items-center justify-center gap-6 select-none">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="rounded-md p-2 bg-zinc-100 dark:bg-zinc-900 w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]">
            {player('w-full h-full')}
          </div>
          <div className="text-center sm:text-left">
            <div className="text-sm uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {shown.def ? t('common.f2lCase', { number: shown.def.number }) : current}
            </div>
            <div className="font-mono text-6xl sm:text-7xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {elapsed.toFixed(3)}
            </div>
          </div>
        </div>
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={record}
            className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 font-semibold"
          >
            ✓ {t('common.record')}
          </button>
          <button
            type="button"
            onClick={discard}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✗ {t('common.discard')}
          </button>
        </div>
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

  const selectedNote = mounted
    ? ` · ${t('trainer.selectedCount', { count: selected.size, total: F2L_IDS.length })}`
    : '';

  // Inverse mode shows the setup scramble right on the start button, so the
  // user can bring their cube into the case before timing.
  if (trainerMode === 'inverse') {
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
          {shown?.setup.scramble || '…'}
        </div>
        <div className="text-sm font-medium opacity-90 uppercase tracking-wider">
          {t('trainer.tapOrSpaceToStart')}
        </div>
        <div className="text-xs opacity-75">
          {t('trainer.hint.varied')} — {t('trainer.hint.f2lSolvedEnough')}
          {selectedNote}
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
        {t('trainer.f2l.hidden')}
        {selectedNote}
      </div>
    </button>
  );
}
