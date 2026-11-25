'use client';

import { useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import { useT } from '@/hooks/useT';
import type { PracticeLogSnapshot } from '@/lib/practice-log';
import { displayRotation } from '@/lib/smart-cube/holding';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import { MarkSolvedButton } from './MarkSolvedButton';
import { ConnectPrompt, CubeStage, RecognitionTimer, SolveTimer, StageResult, type StageRing } from './CubeStage';
import { SessionStats } from './SessionStats';
import { SmartCubeSetupStatus, SmartCubeSetupTokens } from './SmartCubeSetupGuide';
import { VirtualCube } from './VirtualCube';

type TrainerState = 'idle' | 'running' | 'stopped';

function ringOf(state: TrainerState, view: SmartTrainerView | null): StageRing {
  if (state === 'running') return 'running';
  if (state === 'stopped') return 'stopped';
  return view?.phase === 'ready' ? 'ready' : 'waiting';
}

// With setup on a connected smart cube: the same calm screen as no-scramble
// practice, but the case is made on the cube itself. Beside the cube, the
// setup is guided turn by turn; once it is done the recognition timer runs
// until the first turn, then the solving timer until the goal. The cube in
// the frame shows what the cube should look like: the setup done so far, then
// the solving turns.
export function SmartSetupStage({ practice, state, view, connected, log, elapsed, selectedNote, progress, onStop, onNext, onUndo }: {
  practice: TrainerPractice;
  state: TrainerState;
  view: SmartTrainerView | null;
  connected: boolean;
  log: PracticeLogSnapshot;
  elapsed: number;
  selectedNote: string;
  /** Which case of a round is on screen, e.g. 3/21. */
  progress?: string;
  onStop: () => void;
  onNext: () => void;
  onUndo: (key: number) => void;
}) {
  const { t } = useT();
  const { holding } = useSmartCubeSettings();
  const latest = state === 'stopped' ? log.results[0] : undefined;
  const done = view ? view.plan.tokens.slice(0, view.doneTokens).join(' ') : '';
  return (
    <CubeStage
      ring={ringOf(state, view)}
      holding={holding}
      action={connected && state !== 'running' && <MarkSolvedButton variant="link" />}
      cube={view && (
        <VirtualCube
          practice={practice}
          holding={holding}
          setupAlg={`${displayRotation(holding)} ${done}`.trim()}
          moves={view.moves}
          resetKey={0}
          className="w-full h-full"
        />
      )}
      progress={progress}
      session={<SessionStats results={log.results} note={selectedNote} />}
    >
      {!connected ? (
        <ConnectPrompt />
      ) : state === 'stopped' ? (
        <StageResult result={latest} elapsed={elapsed} settle={log.settle} onNext={onNext} onUndo={onUndo} />
      ) : state === 'running' ? (
        <SolveTimer elapsed={elapsed} recognitionMs={view?.recognitionMs ?? null} onStop={onStop} />
      ) : !view ? null : view.phase === 'ready' ? (
        <>
          <div className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            {t('trainer.noScramble.firstTurn')}
          </div>
          {view.readySince !== null && <RecognitionTimer since={view.readySince} />}
        </>
      ) : (
        <>
          {view.phase === 'setup' && (
            <>
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{t('smartCube.trainer.turn')}</div>
              <div className="w-full font-mono text-2xl sm:text-3xl font-bold break-words leading-snug text-zinc-900 dark:text-zinc-50">
                <SmartCubeSetupTokens view={view} />
              </div>
            </>
          )}
          <SmartCubeSetupStatus view={view} practice={practice} />
        </>
      )}
    </CubeStage>
  );
}
