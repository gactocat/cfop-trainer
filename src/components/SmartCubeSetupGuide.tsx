'use client';

import { useT } from '@/hooks/useT';
import type { SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

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
      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
        view.undo && view.phase === 'setup'
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
          : 'bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
      }`}
    >
      {message}
    </div>
  );
}
