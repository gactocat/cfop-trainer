'use client';

import { useEffect, useRef, useState } from 'react';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useTestCube, useTestCubeHints } from '@/hooks/useTestCube';
import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { TEST_CUBE_KEYS, moveForKey } from '@/lib/smart-cube/test-cube';
import type { TestCubeHintKind } from '@/lib/test-cube-hints';
import { resetGrip, runTestCube, runTestCubeHint, stopRun, turnTestCube } from '@/lib/test-cube-store';
import { MarkSolvedButton } from './MarkSolvedButton';

const FACE_MOVES = ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"];
const OTHER_MOVES = ['M', "M'", 'x', "x'", 'y', "y'", 'z', "z'"];
const GAPS = [100, 250, 500, 1000];
const HINT_LABEL: Record<TestCubeHintKind, MessageKey> = {
  setup: 'smartCube.test.hint.setup',
  solution: 'smartCube.test.hint.solution',
  scramble: 'smartCube.test.hint.scramble',
  unscramble: 'smartCube.test.hint.unscramble',
};

const typing = (target: EventTarget | null) => {
  const el = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || !!el?.isContentEditable;
};

// The test cube's controls, over every screen while it is connected: buttons
// and keys that turn it, a box to run moves one by one, the moves the screen
// offers (the setup, the solution, the scramble) in one tap, and "mark as
// solved". It folds down to a small tab.
export function TestCubePanel() {
  const { t } = useT();
  const cube = useSmartCube();
  const on = cube.virtual && cube.status === 'connected';
  const { run, rotated } = useTestCube();
  const hints = useTestCubeHints();
  const [open, setOpen] = useState(true);
  const [alg, setAlg] = useState('');
  const [gap, setGap] = useState(250);
  const [invalid, setInvalid] = useState(false);
  const box = useRef<HTMLElement | null>(null);

  // Pages and the practice screen leave this much room at the bottom, so the
  // panel covers none of their buttons.
  useEffect(() => {
    const root = document.documentElement;
    const element = box.current;
    if (!on || !element) return;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--test-cube-inset', `${Math.ceil(element.getBoundingClientRect().height) + 20}px`);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--test-cube-inset');
    };
  }, [on, open]);

  // Keys turn the cube anywhere, except while typing or with a modifier held.
  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      const move = moveForKey(event.key);
      if (!move) return;
      event.preventDefault();
      turnTestCube(move);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on]);

  if (!on) return null;

  const play = (moves: string) => setInvalid(!runTestCube(moves, gap));
  const button = 'rounded-md border border-zinc-300 bg-white px-1 py-1 font-mono text-sm font-semibold hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:active:bg-zinc-700';
  const small = 'rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';

  if (!open) {
    return (
      <button ref={(element) => { box.current = element; }} type="button" onClick={() => setOpen(true)} aria-label={t('smartCube.test.show')}
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-[55] inline-flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-lg dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100">
        <span aria-hidden className="size-2 rounded-full bg-amber-500" />
        {t('smartCube.test.title')}
        <span aria-hidden>▴</span>
      </button>
    );
  }

  return (
    <section ref={(element) => { box.current = element; }} aria-label={t('smartCube.test.title')}
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-[55] max-h-[70vh] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-amber-400 bg-amber-50/95 p-3 text-sm text-zinc-900 shadow-xl backdrop-blur dark:border-amber-600 dark:bg-zinc-900/95 dark:text-zinc-100">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <span aria-hidden className="size-2 rounded-full bg-amber-500" />
          {t('smartCube.test.title')}
        </h2>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('smartCube.test.hide')}
          className="rounded px-1.5 text-zinc-500 hover:bg-amber-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">▾</button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:grid-cols-10">
        {[...FACE_MOVES, ...OTHER_MOVES].map((move) => (
          <button key={move} type="button" className={button} onClick={() => turnTestCube(move)}>{move}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button type="button" className={small} disabled={!rotated} onClick={resetGrip}>{t('smartCube.test.resetGrip')}</button>
        <MarkSolvedButton variant="link" />
      </div>

      {hints.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hints.map((hint) => (
            <button key={hint.kind} type="button" title={hint.alg} disabled={run !== null} onClick={() => setInvalid(!runTestCubeHint(hint, gap))}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {t(HINT_LABEL[hint.kind])}
            </button>
          ))}
        </div>
      )}

      {run && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{t('smartCube.test.running', { done: run.done, total: run.total })}</span>
          <button type="button" className={small} onClick={stopRun}>{t('smartCube.test.stop')}</button>
        </div>
      )}

      <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-300">{t('smartCube.test.alg')}</summary>
      <form className="mt-1.5 space-y-1.5" onSubmit={(event) => { event.preventDefault(); play(alg); }}>
        <label className="sr-only" htmlFor="test-cube-alg">{t('smartCube.test.alg')}</label>
        <textarea id="test-cube-alg" rows={2} value={alg} spellCheck={false} autoCapitalize="none"
          onChange={(event) => { setAlg(event.target.value); setInvalid(false); }}
          placeholder="R U R' U'"
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            {t('smartCube.test.gap')}
            <select value={gap} onChange={(event) => setGap(Number(event.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-950">
              {GAPS.map((ms) => <option key={ms} value={ms}>{t('smartCube.test.ms', { ms })}</option>)}
            </select>
          </label>
          <button type="submit" className={small} disabled={!alg.trim() || run !== null}>{t('smartCube.test.run')}</button>
        </div>
      </form>
      </details>
      {invalid && <p role="alert" className="mt-1 text-xs text-amber-800 dark:text-amber-200">{t('smartCube.test.invalid')}</p>}

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-zinc-600 dark:text-zinc-300">{t('smartCube.test.keys')}</summary>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">{t('smartCube.test.keysHelp')}</p>
        <dl className="mt-1 grid grid-cols-4 gap-x-3 gap-y-0.5 font-mono">
          {Object.entries(TEST_CUBE_KEYS).map(([key, move]) => (
            <div key={key} className="flex justify-between gap-1">
              <dt className="uppercase text-zinc-500 dark:text-zinc-400">{key}</dt>
              <dd>{move}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
