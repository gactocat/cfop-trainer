// What the screen in use offers the test cube to run in one tap: the setup or
// scramble being guided, the case's solution, the inverse of a scramble.
// A screen sets its hints while it shows them; the test cube panel reads them.

import type { Face } from '@/lib/smart-cube/cube-state';
import type { Frame } from '@/lib/smart-cube/holding';
import type { GuideProgress, GuideView, SetupPlan } from '@/lib/smart-cube/setup-guide';
import { stepTurns, type TestCubeTurn } from '@/lib/smart-cube/test-cube';

export type TestCubeHintKind = 'setup' | 'solution' | 'scramble' | 'unscramble';
export interface TestCubeHint {
  kind: TestCubeHintKind;
  /** The moves, as shown. */
  alg: string;
  /** Cube-frame quarter turns to make instead of reading `alg` (the rest of a guide), and the grip after them. */
  turns?: readonly TestCubeTurn[];
  frame?: Frame;
  /** Read `alg` from this grip and end in it: the holding a case or scramble is shown in. */
  grip?: Frame;
}

let owner: object | null = null;
let hints: readonly TestCubeHint[] = [];
const listeners = new Set<() => void>();
const NONE: readonly TestCubeHint[] = [];

export const getHints = () => hints;
export const getServerHints = () => NONE;
export function subscribeHints(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setHints(from: object, next: readonly TestCubeHint[]) {
  owner = from;
  hints = next.filter((h) => h.alg.trim() !== '');
  listeners.forEach((l) => l());
}

export function clearHints(from: object) {
  if (owner !== from) return;
  owner = null;
  hints = NONE;
  listeners.forEach((l) => l());
}

/** What is left of a guided setup or scramble: the turns to take back, the rest of the step, the tokens after it. */
export function remainingGuide(tokens: readonly string[], view: GuideView): string {
  const rest = tokens.slice(view.doneTokens + (view.remaining ? 1 : 0));
  return [view.undo, view.remaining, ...rest].filter(Boolean).join(' ');
}

/**
 * The cube-frame turns that finish a guided setup or scramble from where it
 * is: take back the wrong turns, finish the step begun, make the steps left
 * (a slice as a real cube reports it, both faces together).
 * Taken from the plan itself, so rotations already passed (which the shown
 * tokens count as done) and groups are followed exactly.
 */
export function guideTurns(plan: SetupPlan, progress: GuideProgress): { turns: TestCubeTurn[]; frame: Frame } {
  const turns: TestCubeTurn[] = [];
  for (const wrong of [...progress.wrong].reverse()) turns.push(...stepTurns({ [wrong.face]: -wrong.amount }));
  plan.steps.slice(progress.step).forEach((step, i) => {
    const left = Object.fromEntries((Object.entries(step.turns) as [Face, number][])
      .map(([face, amount]) => [face, amount - (i === 0 ? progress.acc[face] ?? 0 : 0)]));
    turns.push(...stepTurns(left));
  });
  return { turns, frame: plan.finalFrame };
}
