'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/hooks/useT';
import { SETTLE_MS } from '@/lib/practice-log';
import type { PracticeResult } from '@/lib/practice-log';
import type { MessageKey } from '@/i18n/messages';
import { openAppDialog } from '@/lib/app-dialog';
import type { CubeHolding } from '@/lib/smart-cube/holding';

// Shared parts of the practice screens driven by a smart cube (no setup on a
// virtual cube, or with setup on the cube itself): a calm stage with the cube
// in a frame whose colour shows the state, what to do or the result beside it,
// and this session's figures (SessionStats).

export type StageRing = 'waiting' | 'ready' | 'running' | 'stopped';

const RING: Record<StageRing, string> = {
  waiting: 'ring-zinc-300 dark:ring-zinc-700',
  ready: 'ring-emerald-400/80 dark:ring-emerald-500/70',
  running: 'ring-rose-400 dark:ring-rose-500',
  stopped: 'ring-amber-400 dark:ring-amber-500',
};

const HOLDING: Record<CubeHolding, MessageKey> = {
  'yellow-blue': 'smartCube.holding.yellowBlue',
  'yellow-green': 'smartCube.holding.yellowGreen',
  'white-green': 'smartCube.holding.whiteGreen',
};

// The cube's frame keeps its place in every state, so the same player (and
// WebGL context) stays mounted and nothing moves under the solver's eyes.
export function CubeStage({ ring, holding, progress, action, cube, children, session }: {
  ring: StageRing;
  holding: CubeHolding | null;
  /** Which case of a round is on screen, e.g. 3/21. */
  progress?: string;
  /** A small control above the cube, at the right (e.g. back to the case). */
  action?: ReactNode;
  cube: ReactNode;
  /** What to do, the timers or the result. */
  children: ReactNode;
  session: ReactNode;
}) {
  const { t } = useT();
  return (
    // Scrolls within the practice screen when the cube, the timers and the
    // session table do not fit one above another (a phone held upright).
    <div className="w-full flex-1 min-h-[280px] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950/60 flex flex-col items-center justify-start gap-6 xl:flex-row xl:items-center xl:justify-center select-none">
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="rounded-full bg-zinc-200/80 px-2.5 py-1 dark:bg-zinc-800">
                {holding ? t(HOLDING[holding]) : ' '}
              </span>
              {progress && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium tabular-nums text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{progress}</span>}
            </span>
            {action}
          </div>
          <div className={`shrink-0 rounded-xl bg-zinc-100 p-2 ring-4 transition-colors dark:bg-zinc-900 w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] ${RING[ring]}`}>
            {cube}
          </div>
        </div>

        {/* As tall as the cube, so changing what it shows never moves the cube. */}
        <div className="flex w-full max-w-sm min-h-[300px] flex-col items-center justify-center gap-3 text-center md:w-80 md:min-h-[332px]">
          {children}
        </div>
      </div>

      {session}
    </div>
  );
}

/** Seconds since `since` (performance.now() time), redrawn every frame. */
export function LiveTimer({ since, digits = 2 }: { since: number; digits?: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <>{(Math.max(0, now - since) / 1000).toFixed(digits)}</>;
}

/** The recognition timer: from the case being ready to the first turn. */
export function RecognitionTimer({ since }: { since: number }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center gap-1" aria-live="off">
      <span className="text-xs font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">{t('trainer.cube.recognition')}</span>
      <span className="font-mono text-5xl sm:text-6xl font-bold tabular-nums leading-none text-sky-700 dark:text-sky-300">
        <LiveTimer since={since} />
      </span>
    </div>
  );
}

/** The solving timer, with the recognition time it started after. */
export function SolveTimer({ elapsed, recognitionMs, onStop, hint }: {
  elapsed: number;
  recognitionMs: number | null;
  onStop: () => void;
  hint?: ReactNode;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      onPointerDown={onStop}
      aria-label={t('trainer.tapToStopAria')}
      className="flex flex-col items-center gap-2 rounded-md px-4 py-2 touch-none"
    >
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('trainer.cube.solve')}</span>
      <span className="font-mono text-6xl sm:text-7xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50" aria-live="polite">
        {elapsed.toFixed(3)}
      </span>
      {recognitionMs !== null && (
        <span className="font-mono text-xs text-sky-700 dark:text-sky-300">
          {t('trainer.cube.recognition')} {(recognitionMs / 1000).toFixed(2)}
        </span>
      )}
      <span className="text-xs font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">{t('smartCube.trainer.autoStop')}</span>
      {hint}
    </button>
  );
}

/** Without a connected cube there is nothing to solve: offer to connect one. */
export function ConnectPrompt() {
  const { t } = useT();
  return (
    <>
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{t('trainer.noScramble.connect')}</p>
      <button
        type="button"
        onClick={() => openAppDialog('smartCube')}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        {t('practice.cube.connect')}
      </button>
    </>
  );
}

/** The latest solve: recognition and solving apart, then what to do next. */
export function StageResult({ result, elapsed, settle, onNext, onUndo }: {
  result: PracticeResult | undefined;
  elapsed: number;
  settle: { key: number } | null;
  onNext: () => void;
  onUndo: (key: number) => void;
}) {
  const { t } = useT();
  const undone = result?.undone ?? false;
  const details = result && result.moveCount !== null && result.tps !== null
    ? t('smartCube.solve.summary', { moves: result.moveCount, tps: result.tps.toFixed(2) })
    : null;
  return (
    <>
      {result && (
        <div className="text-sm font-semibold tracking-wide text-amber-700 dark:text-amber-300">{result.name}</div>
      )}
      <div className={`flex items-end justify-center gap-6 ${undone ? 'opacity-50' : ''}`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-sky-700 dark:text-sky-300">{t('trainer.cube.recognition')}</span>
          <span className={`font-mono text-2xl font-bold tabular-nums leading-none text-sky-700 dark:text-sky-300 ${undone ? 'line-through' : ''}`}>
            {result?.recognitionMs != null ? (result.recognitionMs / 1000).toFixed(2) : '-'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('trainer.cube.solve')}</span>
          <span className={`font-mono text-6xl sm:text-7xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50 ${undone ? 'line-through' : ''}`}>
            {(result?.seconds ?? elapsed).toFixed(3)}
          </span>
        </div>
      </div>
      {details && <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{details}</div>}
      {result?.solution && (
        <p className="max-w-xs font-mono text-sm break-words text-zinc-700 dark:text-zinc-300">{result.solution}</p>
      )}
      <div className="mt-1 flex w-full max-w-xs flex-col items-center gap-2">
        {settle && (
          <>
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
              <div
                key={settle.key}
                className="h-full origin-left bg-emerald-500"
                style={{ animation: `no-scramble-settle ${SETTLE_MS}ms linear forwards` }}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.settle')}</p>
          </>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t('trainer.noScramble.next')}
            <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Space</kbd>
          </button>
          {result && !result.undone && (
            <button
              type="button"
              onClick={() => onUndo(result.key)}
              className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {t('trainer.noScramble.undo')}
              <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Esc</kbd>
            </button>
          )}
        </div>
        {result?.undone && <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.undone')}</p>}
      </div>
    </>
  );
}
