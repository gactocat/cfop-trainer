'use client';

import type { ReactNode } from 'react';
import { useT } from '@/hooks/useT';
import type { NoScrambleView } from '@/hooks/useNoScrambleTrainer';
import { openAppDialog } from '@/lib/app-dialog';
import { VirtualCube } from './VirtualCube';

type TrainerState = 'idle' | 'running' | 'stopped';

const TONES: Record<TrainerState, string> = {
  idle: 'bg-emerald-500 text-white dark:bg-emerald-600',
  running: 'bg-rose-500 text-white dark:bg-rose-600',
  stopped: 'border border-amber-400 bg-amber-50 text-zinc-900 dark:border-amber-500 dark:bg-amber-950/30 dark:text-zinc-100',
};

const smallButton = 'rounded-md border border-current/40 px-3 py-1.5 text-sm font-medium hover:bg-white/15';

// No-scramble screen for every trainer state. The virtual cube is the first
// child in all of them, so React keeps the same player (and WebGL context)
// while the start, timing and result screens swap the content beside it.
export function NoScrambleStage({ state, view, connected, elapsed, selectedNote, onStop, onReset, result }: {
  state: TrainerState;
  view: NoScrambleView | null;
  connected: boolean;
  elapsed: number;
  selectedNote: string;
  onStop: () => void;
  onReset: () => void;
  /** The result screen's details and buttons, from the trainer. */
  result: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className={`w-full flex-1 min-h-[280px] rounded-lg p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 select-none transition-colors ${TONES[state]}`}>
      <div className={`shrink-0 rounded-md p-2 w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] ${state === 'stopped' ? 'bg-zinc-100 dark:bg-zinc-900' : 'bg-white/15'}`}>
        {view && <VirtualCube setupAlg={view.setupAlg} moves={view.moves} resetKey={view.resetKey} className="w-full h-full" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 text-center">
        {state === 'idle' && (connected ? (
          <>
            <div className="text-sm font-medium uppercase tracking-wider opacity-90">{t('trainer.noScramble.solve')}</div>
            <p className="max-w-sm text-sm opacity-90">{t('trainer.noScramble.firstTurn')}</p>
            <button type="button" className={smallButton} onClick={onReset}>{t('trainer.noScramble.reset')}</button>
            <div className="text-xs opacity-75">{selectedNote}</div>
          </>
        ) : (
          <>
            <p className="max-w-sm text-sm font-medium">{t('trainer.noScramble.connect')}</p>
            <button
              type="button"
              onClick={() => openAppDialog('smartCube')}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-zinc-800"
            >
              {t('trainer.noScramble.connectButton')}
            </button>
          </>
        ))}
        {state === 'running' && (
          <>
            <button
              type="button"
              onPointerDown={onStop}
              aria-label={t('trainer.tapToStopAria')}
              className="flex flex-col items-center gap-2 rounded-md px-4 py-2 touch-none"
            >
              <span className="font-mono text-6xl sm:text-8xl font-bold tabular-nums leading-none" aria-live="polite">
                {elapsed.toFixed(3)}
              </span>
              <span className="text-sm font-medium uppercase tracking-wider opacity-90">{t('trainer.tapOrSpaceToStop')}</span>
              <span className="text-xs opacity-80">{t('smartCube.trainer.autoStop')}</span>
            </button>
            <button type="button" className={smallButton} onClick={onReset}>{t('trainer.noScramble.reset')}</button>
          </>
        )}
        {state === 'stopped' && result}
      </div>
    </div>
  );
}
