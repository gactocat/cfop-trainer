// The test cube's controls: connecting it, turning it from keys and buttons,
// and running a sequence of moves one by one. The cube (test-cube.ts) is
// connected through smart-cube-store like a real one; this keeps the grip
// (how it is held after rotations) and the sequence running.

import type { Face } from '@/lib/smart-cube/cube-state';
import { holdingFrame, type Frame } from '@/lib/smart-cube/holding';
import { TEST_CUBE_MAC, TEST_CUBE_NAME, TestCube, testCubeTurns, type TestCubeTurn } from '@/lib/smart-cube/test-cube';
import { connectVirtual, getSnapshot as getCubeSnapshot } from '@/lib/smart-cube-store';
import type { TestCubeHint } from '@/lib/test-cube-hints';
import { getSnapshot as getSettings } from '@/lib/smart-cube-settings-store';

export interface TestCubeRun {
  done: number;
  total: number;
}

export interface TestCubeSnapshot {
  /** The sequence being run, or null. */
  run: TestCubeRun | null;
  /** Held differently from the chosen holding after a rotation. */
  rotated: boolean;
}

/** The half of a half turn waits this long at most, as a hand turns it. */
const HALF_TURN_MS = 60;
/** A slice's second face comes this long after its first, as a real cube reports them. */
const SLICE_LAG_MS = 12;

let cube: TestCube | null = null;
let grip: Frame | null = null;
let runTimer: ReturnType<typeof setTimeout> | null = null;
let snapshot: TestCubeSnapshot = { run: null, rotated: false };
const listeners = new Set<() => void>();
const SERVER: TestCubeSnapshot = { run: null, rotated: false };

function update(patch: Partial<TestCubeSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => SERVER;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const holding = () => getSettings().holding;
const currentGrip = () => grip ?? holdingFrame(holding());
const active = () => cube !== null && cube.connected && getCubeSnapshot().virtual;

/** Connect a new test cube (solved), in place of any cube connected. */
export async function connectTestCube() {
  stopRun();
  const next = new TestCube();
  cube = next;
  grip = null;
  update({ rotated: false });
  await connectVirtual(TEST_CUBE_NAME, TEST_CUBE_MAC, (handlers) => next.open(handlers));
}

/** Make `alg` at once, in the user's notation from the current grip. False when it cannot be read. */
export function turnTestCube(alg: string): boolean {
  if (!active()) return false;
  const planned = testCubeTurns(alg, currentGrip());
  if (!planned) return false;
  for (const [face, amount] of planned.turns) cube!.turn(face, amount);
  setGrip(planned.frame);
  return true;
}

function setGrip(frame: Frame) {
  grip = frame;
  const home = holdingFrame(holding());
  update({ rotated: (Object.keys(home) as Face[]).some((f) => home[f] !== frame[f]) });
}

/** Hold the cube the chosen way again. */
export function resetGrip() {
  grip = null;
  update({ rotated: false });
}

/** Run `alg` one move every `gapMs`. False when it cannot be read. */
export function runTestCube(alg: string, gapMs: number): boolean {
  if (!active()) return false;
  const planned = testCubeTurns(alg, currentGrip());
  if (!planned) return false;
  runTurns(planned.turns, planned.frame, gapMs);
  return true;
}

/** Run moves the screen offers (see test-cube-hints.ts). False when they cannot be read. */
export function runTestCubeHint(hint: TestCubeHint, gapMs: number): boolean {
  if (!active()) return false;
  if (hint.turns) {
    runTurns(hint.turns, hint.frame ?? currentGrip(), gapMs);
    return true;
  }
  const planned = testCubeTurns(hint.alg, hint.grip ?? currentGrip());
  if (!planned) return false;
  runTurns(planned.turns, hint.grip ?? planned.frame, gapMs);
  return true;
}

function runTurns(turns: readonly TestCubeTurn[], frameAfter: Frame, gapMs: number) {
  stopRun();
  setGrip(frameAfter);
  let i = 0;
  update({ run: { done: 0, total: turns.length } });
  const step = () => {
    if (!active() || i >= turns.length) {
      runTimer = null;
      update({ run: null });
      return;
    }
    const [face, amount] = turns[i];
    cube!.turn(face, amount);
    i++;
    update({ run: { done: i, total: turns.length } });
    const next = turns[i];
    const halfTurn = next && next[0] === face && next[1] === amount && turns[i - 2]?.[0] !== face;
    runTimer = setTimeout(step, next?.[2] ? SLICE_LAG_MS : halfTurn ? Math.min(gapMs, HALF_TURN_MS) : gapMs);
  };
  step();
}

export function stopRun() {
  if (runTimer) clearTimeout(runTimer);
  runTimer = null;
  if (snapshot.run) update({ run: null });
}
