'use client';

import { useT } from '@/hooks/useT';
import type { SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

// The setup on the start screen, with the tokens already turned dimmed and the
// next one underlined.
export function SmartCubeSetupTokens({ view }: { view: SmartTrainerView }) {
  return (
    <>
      {view.plan.tokens.map((token, i) => (
        <span
          key={i}
          className={i < view.doneTokens ? 'opacity-40' : i === view.doneTokens ? 'underline decoration-2 underline-offset-8' : ''}
        >
          {i > 0 ? ' ' : ''}{token}
        </span>
      ))}
    </>
  );
}

// What to do next on the cube: solve to the starting state, finish a half
// turn, take back wrong turns, or start solving.
export function SmartCubeSetupStatus({ view, practice }: { view: SmartTrainerView; practice: TrainerPractice }) {
  const { t } = useT();
  let message: string | null = null;
  if (view.phase === 'need-base') message = t(`smartCube.trainer.needBase.${practice}`);
  else if (view.phase === 'ready') message = t('smartCube.trainer.ready');
  else if (view.undo) message = t('smartCube.trainer.undo', { moves: view.undo });
  else if (view.remaining) message = t('smartCube.trainer.remaining', { moves: view.remaining });
  if (!message) return null;
  return (
    <div
      aria-live="polite"
      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view.undo && view.phase === 'setup' ? 'bg-rose-700/80' : 'bg-white/20'}`}
    >
      {message}
    </div>
  );
}
