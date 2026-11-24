import { update, type PracticeSettings } from '@/lib/practice-settings-store';
import { setNoScramble } from '@/lib/smart-cube-settings-store';

/**
 * The practice mode the user chooses: solve the case without a setup, or
 * apply a setup to the cube first. A connected smart cube changes how each
 * one runs (see `trainerFlavor`), so the cube is not a mode of its own.
 */
export type PracticeMode = 'no-setup' | 'setup';

/**
 * How a practice actually runs: no setup is the tap timer without a smart
 * cube and the virtual cube (no-scramble) with one; with setup is the
 * inverse-setup tap trainer without a cube and, with one, the guided setup
 * on the cube (smart-setup), timed and recorded by the cube like no-scramble.
 */
export type TrainerFlavor = 'standard' | 'inverse' | 'no-scramble' | 'smart-setup';

/** Flavors driven by a smart cube: a calm stage, solves recorded as they stop. */
export const isCubeFlavor = (flavor: TrainerFlavor) => flavor === 'no-scramble' || flavor === 'smart-setup';

/**
 * Read the mode from what is stored. The synced practice settings keep the
 * values older app versions know ('standard' and 'inverse'); before there
 * were two modes, no-scramble was a separate device-local flag on top of
 * them. Standard and no-scramble both read as no setup, inverse as setup.
 */
export function practiceModeFrom(
  trainerMode: PracticeSettings['trainerMode'],
  legacyNoScramble: boolean,
): PracticeMode {
  if (legacyNoScramble) return 'no-setup';
  return trainerMode === 'inverse' ? 'setup' : 'no-setup';
}

/** The synced value that stores `mode`. */
export function storedTrainerMode(mode: PracticeMode): PracticeSettings['trainerMode'] {
  return mode === 'setup' ? 'inverse' : 'standard';
}

/** How a practice in `mode` runs, given whether a smart cube is connected. */
export function trainerFlavor(mode: PracticeMode, cubeConnected: boolean): TrainerFlavor {
  if (mode === 'setup') return cubeConnected ? 'smart-setup' : 'inverse';
  return cubeConnected ? 'no-scramble' : 'standard';
}

/**
 * Choose the practice mode. It is stored in the synced practice settings;
 * the old device-local no-scramble flag is cleared, since it would keep
 * reading as no setup.
 */
export function choosePracticeMode(mode: PracticeMode): void {
  update({ trainerMode: storedTrainerMode(mode) });
  setNoScramble(false);
}
