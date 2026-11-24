'use client';

import { useT } from '@/hooks/useT';
import type { NoScrambleView } from '@/hooks/useNoScrambleTrainer';
import type { PracticeLogSnapshot } from '@/lib/practice-log';
import { ConnectPrompt, CubeStage, RecognitionTimer, SessionTable, SolveTimer, StageResult, type StageRing } from './CubeStage';
import { VirtualCube } from './VirtualCube';

type TrainerState = 'idle' | 'running' | 'stopped';

const RING: Record<TrainerState, StageRing> = { idle: 'ready', running: 'running', stopped: 'stopped' };

// No-scramble practice, driven by the cube alone: the case on a virtual cube
// that the smart cube's turns move, the recognition and solving timers or the
// result beside it, and this session's figures per case.
export function NoScrambleStage({ state, view, connected, log, elapsed, selectedNote, onReset, onStop, onNext, onUndo }: {
  state: TrainerState;
  view: NoScrambleView | null;
  connected: boolean;
  log: PracticeLogSnapshot;
  elapsed: number;
  selectedNote: string;
  onReset: () => void;
  onStop: () => void;
  onNext: () => void;
  onUndo: (key: number) => void;
}) {
  const { t } = useT();
  const latest = state === 'stopped' ? log.results[0] : undefined;
  return (
    <CubeStage
      ring={RING[state]}
      holding={view?.holding ?? null}
      action={connected && state !== 'stopped' && (
        <button type="button" onClick={onReset} className="rounded px-1 py-1 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
          {t('trainer.noScramble.reset')}
        </button>
      )}
      cube={view && (
        <VirtualCube
          practice={view.practice}
          holding={view.holding}
          setupAlg={view.setupAlg}
          moves={view.moves}
          resetKey={view.resetKey}
          className="w-full h-full"
        />
      )}
      session={<SessionTable results={log.results} note={selectedNote} />}
    >
      {!connected ? (
        <ConnectPrompt />
      ) : state === 'idle' ? (
        <>
          <div className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            {t('trainer.noScramble.firstTurn')}
          </div>
          {view && <RecognitionTimer key={view.resetKey} since={view.shownAt} />}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.anyState')}</p>
        </>
      ) : state === 'running' ? (
        <SolveTimer
          elapsed={elapsed}
          recognitionMs={view?.recognitionMs ?? null}
          onStop={onStop}
          hint={<span className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">{t('trainer.noScramble.resetHint')}</span>}
        />
      ) : (
        <StageResult result={latest} elapsed={elapsed} settle={log.settle} onNext={onNext} onUndo={onUndo} />
      )}
    </CubeStage>
  );
}
