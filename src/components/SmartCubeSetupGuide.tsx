import type { SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import type { MessageKey } from '@/i18n/messages';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

/**
 * What the cube needs before the setup can be followed, for the status line
 * under it: to be solved to the starting state first. Nothing else is said
 * in words: a turn to take back shows in the setup's place (in red), and the
 * rest of a half turn on the 3D cube, which turns it part of the way.
 */
export function setupStatusKey(view: SmartTrainerView, practice: TrainerPractice): MessageKey | null {
  return view.phase === 'need-base' ? `smartCube.trainer.needBase.${practice}` : null;
}
