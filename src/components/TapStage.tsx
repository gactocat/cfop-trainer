'use client';

import type { ReactNode } from 'react';
import type { useHoldTimer } from '@/hooks/useHoldTimer';
import { useT } from '@/hooks/useT';
import { toneOf, type HoldPhase } from '@/lib/hold-timer';
import type { PracticeResult } from '@/lib/practice-log';
import { TimerDigits } from './TimerDigits';

const FRAME = 'w-full flex-1 min-h-[320px] rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950/60';
const CHIP = 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium tabular-nums text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';

// Practice without a smart cube, on a calm screen: the timer from the start,
// held to get ready (red, then green once letting go starts), let go to
// start, pressed anywhere to stop.
// While held long enough and while running, everything but the timer (and,
// with no setup, the case to solve) steps aside. The result is recorded in
// the session at once, with Next and Undo, and the session's figures below.
export function TapStage({
  phase, pressProps, elapsed, setup, caseView, caseBox, note, progress, result, solution, extra, onNext, onUndo, session,
}: {
  phase: HoldPhase;
  pressProps: ReturnType<typeof useHoldTimer>['pressProps'];
  elapsed: number;
  /** With setup: what to make on the cube before starting. Null without setup: the case shows when the timer starts. */
  setup: string | null;
  /** The case: shown while timing when there is no setup, and with the result. */
  caseView: ReactNode;
  /** Size classes of the case's frame. */
  caseBox: string;
  note?: string;
  /** Which case of a round is on screen, e.g. 3/21. */
  progress?: string;
  result: PracticeResult | undefined;
  solution: ReactNode;
  /** Under the result's time, e.g. the practised algorithm's best and ao5. */
  extra?: ReactNode;
  onNext: () => void;
  onUndo: (key: number) => void;
  session: ReactNode;
}) {
  const { t } = useT();
  const focus = phase === 'armed' || phase === 'running';
  const aside = focus ? 'invisible' : '';
  const undone = result?.undone ?? false;

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-4 xl:flex-row xl:items-stretch">
      {phase === 'stopped' ? (
        <div className={`${FRAME} relative flex flex-col items-center justify-center gap-4 text-center`}>
          {progress && <span className={`absolute left-3 top-3 ${CHIP}`}>{progress}</span>}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
            <div className={`shrink-0 rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900 ${caseBox}`}>{caseView}</div>
            <div className="flex flex-col items-center gap-2 sm:items-start">
              {result && <div className="text-sm font-semibold tracking-wide text-amber-700 dark:text-amber-300">{result.name}</div>}
              <div className={`font-mono text-6xl sm:text-7xl font-bold tabular-nums leading-none text-zinc-900 dark:text-zinc-50 ${undone ? 'line-through opacity-50' : ''}`}>
                {(result?.seconds ?? elapsed).toFixed(3)}
              </div>
              {result && result.moveCount !== null && result.tps !== null && (
                <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {t('smartCube.solve.summary', { moves: result.moveCount, tps: result.tps.toFixed(2) })}
                </div>
              )}
              {extra}
            </div>
          </div>
          {solution}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onNext}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {t('trainer.noScramble.next')}
              <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Space</kbd>
            </button>
            {result && !undone && (
              <button type="button" onClick={() => onUndo(result.key)}
                className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                {t('trainer.noScramble.undo')}
                <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Esc</kbd>
              </button>
            )}
          </div>
          {undone && <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.undone')}</p>}
        </div>
      ) : (
        <div
          {...pressProps}
          role="button"
          aria-label={phase === 'running' ? t('trainer.tapToStopAria') : t('trainer.hold.aria')}
          // No scrolling, zooming, text selection or long-press menu while holding.
          className={`${FRAME} relative flex cursor-pointer flex-col items-center justify-center gap-5 select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none]`}
        >
          {progress && <span className={`absolute left-3 top-3 ${CHIP} ${aside}`}>{progress}</span>}
          {setup !== null ? (
            <div className={`flex max-w-2xl flex-col items-center gap-2 text-center ${aside}`}>
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('trainer.applyToCube')}</div>
              <div className="font-mono text-2xl sm:text-4xl font-bold break-words leading-snug text-zinc-900 dark:text-zinc-50">{setup || '…'}</div>
            </div>
          ) : phase === 'running' ? (
            <div className={`shrink-0 rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900 ${caseBox}`}>{caseView}</div>
          ) : (
            // Holds the case's place, so the timer does not move when it appears.
            <div className={`shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 px-4 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500 ${caseBox} ${aside}`}>
              {t('trainer.hold.caseLater')}
            </div>
          )}
          <TimerDigits tone={toneOf(phase)}>{phase === 'running' ? elapsed.toFixed(3) : '0.000'}</TimerDigits>
          <div className={`flex flex-col items-center gap-1 text-center ${aside}`}>
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {t('trainer.hold.start')}
              <kbd className="hidden sm:inline ml-2 text-[10px] font-mono font-normal opacity-70">Space</kbd>
            </span>
            {note && <span className="text-xs text-zinc-400 dark:text-zinc-500">{note}</span>}
          </div>
        </div>
      )}
      <div className={`flex w-full items-start justify-center xl:w-auto ${phase === 'stopped' ? '' : aside}`}>{session}</div>
    </div>
  );
}
