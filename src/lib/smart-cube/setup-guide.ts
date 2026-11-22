// Follow a setup scramble on a smart cube. The scramble is written in the
// user's notation and may contain wide turns, slices, rotations and groups;
// the cube only reports outer face turns relative to its centres. So the
// scramble is first planned as steps of cube-frame face turns (`planSetup`),
// then each reported turn advances through the steps (`advanceGuide`). A turn
// that does not fit goes on an undo stack, shown as the turns to take back.
//
// Equivalences used: r = L x, l = R x', u = D y, d = U y', f = B z, b = F z',
// M = R L' x', E = U D' y', S = F' B z.

import { tokenizeAlg, invertAlg } from '@/lib/invert-alg';
import { applyTurn, type Amount, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { holdingFrame, rotateFrame, userNotation, type CubeHolding, type Frame } from '@/lib/smart-cube/holding';

export interface SetupStep {
  /** Cube-frame quarter turns this step needs, per face (opposite faces for slices). */
  turns: Partial<Record<Face, Amount>>;
  /** User frame at the start of the step, for writing turns in the user's notation. */
  frame: Frame;
  /** Index of the scramble token the step belongs to. */
  token: number;
}

export interface SetupPlan {
  /** Scramble tokens as displayed (a parenthesised group is one token). */
  tokens: string[];
  steps: SetupStep[];
  /** Number of steps finished once token i is complete. */
  tokenEnds: number[];
  /** User frame after the whole scramble. */
  finalFrame: Frame;
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const WIDE: Record<string, { face: Face; axis: 'x' | 'y' | 'z'; dir: 1 | -1 }> = {
  r: { face: 'L', axis: 'x', dir: 1 },
  l: { face: 'R', axis: 'x', dir: -1 },
  u: { face: 'D', axis: 'y', dir: 1 },
  d: { face: 'U', axis: 'y', dir: -1 },
  f: { face: 'B', axis: 'z', dir: 1 },
  b: { face: 'F', axis: 'z', dir: -1 },
};
// Slice: turn `face` by +n and its opposite by -n, then rotate.
const SLICE: Record<string, { face: Face; axis: 'x' | 'y' | 'z'; dir: 1 | -1 }> = {
  M: { face: 'R', axis: 'x', dir: -1 },
  E: { face: 'U', axis: 'y', dir: -1 },
  S: { face: 'B', axis: 'z', dir: 1 },
};

function parseCount(suffix: string): number | null {
  const m = suffix.match(/^(\d*)('?)$/);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  return m[2] ? -n : n;
}

/** Plan a scramble for a holding. Null when it contains a token that cannot be followed. */
export function planSetup(scramble: string, holding: CubeHolding): SetupPlan | null {
  const tokens = tokenizeAlg(scramble);
  const steps: SetupStep[] = [];
  const tokenEnds: number[] = [];
  let frame = holdingFrame(holding);

  // Consecutive turns of one cube face merge into one step, and cancel when
  // they add up to nothing: "R' z' U" turns the cube's U face both ways.
  const pushTurn = (face: Face, n: number, index: number) => {
    const prev = steps[steps.length - 1];
    const prevFaces = prev ? (Object.keys(prev.turns) as Face[]) : [];
    if (prev && prevFaces.length === 1 && prevFaces[0] === face) {
      const merged = mod4(prev.turns[face]! + n);
      if (merged === 0) steps.pop();
      else steps[steps.length - 1] = { ...prev, turns: { [face]: merged as Amount }, token: index };
      return;
    }
    steps.push({ turns: { [face]: n as Amount }, frame, token: index });
  };

  const expand = (token: string, index: number): boolean => {
    if (token.startsWith('(')) {
      const close = token.lastIndexOf(')');
      const count = parseCount(token.slice(close + 1));
      if (close < 0 || count === null) return false;
      const inner = token.slice(1, close);
      const body = tokenizeAlg(count < 0 ? invertAlg(inner) : inner);
      for (let i = 0; i < Math.abs(count); i++) {
        for (const t of body) if (!expand(t, index)) return false;
      }
      return true;
    }
    const m = token.match(/^([URFDLBMESxyzurfdlb])(w?)(.*)$/);
    if (!m) return false;
    const count = parseCount(m[3]);
    if (count === null) return false;
    const n = mod4(count);
    const base = m[2] ? m[1].toLowerCase() : m[1];
    if (m[2] && !'urfdlb'.includes(base)) return false;
    if (n === 0) return true;
    if ('URFDLB'.includes(base)) {
      pushTurn(frame[base as Face], n, index);
    } else if (base in WIDE) {
      const w = WIDE[base];
      pushTurn(frame[w.face], n, index);
      frame = rotateFrame(frame, w.axis, w.dir * n);
    } else if (base in SLICE) {
      const s = SLICE[base];
      steps.push({
        turns: { [frame[s.face]]: n as Amount, [frame[OPPOSITE[s.face]]]: mod4(-n) as Amount },
        frame,
        token: index,
      });
      frame = rotateFrame(frame, s.axis, s.dir * n);
    } else {
      frame = rotateFrame(frame, base as 'x' | 'y' | 'z', n);
    }
    return true;
  };

  for (let i = 0; i < tokens.length; i++) {
    if (!expand(tokens[i], i)) return null;
    tokenEnds.push(steps.length);
  }
  // A later merge or cancellation can shorten the steps an earlier token ended at.
  for (let i = tokenEnds.length - 1; i >= 0; i--) {
    tokenEnds[i] = Math.min(tokenEnds[i], i + 1 < tokenEnds.length ? tokenEnds[i + 1] : steps.length);
  }
  return { tokens, steps, tokenEnds, finalFrame: frame };
}

/** The state after performing the whole plan from `state`. */
export function applyPlan(state: CubeState, plan: SetupPlan, upTo = plan.steps.length): CubeState {
  let s = state;
  for (const step of plan.steps.slice(0, upTo)) {
    for (const [face, amount] of Object.entries(step.turns) as [Face, Amount][]) s = applyTurn(s, face, amount);
  }
  return s;
}

export interface GuideProgress {
  /** Steps completed. */
  step: number;
  /** Quarter turns made so far on the current step's faces. */
  acc: Partial<Record<Face, number>>;
  /** Turns that did not fit, oldest first (consecutive turns of one face merged). */
  wrong: { face: Face; amount: Amount }[];
}

export const GUIDE_START: GuideProgress = { step: 0, acc: {}, wrong: [] };

/** Every step done and no wrong turn left to take back. */
export function isGuideComplete(plan: SetupPlan, progress: GuideProgress): boolean {
  return progress.step >= plan.steps.length && progress.wrong.length === 0;
}

/** Advance by one reported turn of cube face `face` (1 clockwise, 3 counter-clockwise). */
export function advanceGuide(plan: SetupPlan, progress: GuideProgress, face: Face, amount: Amount): GuideProgress {
  if (progress.wrong.length > 0) {
    const wrong = [...progress.wrong];
    const last = wrong[wrong.length - 1];
    if (last.face === face) {
      const merged = mod4(last.amount + amount);
      if (merged === 0) wrong.pop();
      else wrong[wrong.length - 1] = { face, amount: merged as Amount };
    } else {
      wrong.push({ face, amount });
    }
    return { ...progress, wrong };
  }
  const step = plan.steps[progress.step];
  if (!step || step.turns[face] === undefined) {
    return { ...progress, wrong: [{ face, amount }] };
  }
  const acc = { ...progress.acc, [face]: mod4((progress.acc[face] ?? 0) + amount) };
  const done = (Object.entries(step.turns) as [Face, Amount][]).every(([f, n]) => acc[f] === n);
  return done ? { step: progress.step + 1, acc: {}, wrong: [] } : { ...progress, acc };
}

/** The state the cube should be in if every reported turn went as tracked. */
export function expectedState(base: CubeState, plan: SetupPlan, progress: GuideProgress): CubeState {
  let s = applyPlan(base, plan, progress.step);
  for (const [face, n] of Object.entries(progress.acc) as [Face, number][]) s = applyTurn(s, face, n);
  for (const w of progress.wrong) s = applyTurn(s, w.face, w.amount);
  return s;
}

export interface GuideView {
  /** Tokens fully done, from the start. */
  doneTokens: number;
  /** Turns still needed for the current step when it is partly done, in the user's notation. */
  remaining: string;
  /** Turns that take back the wrong ones, in the user's notation. */
  undo: string;
}

export function guideView(plan: SetupPlan, progress: GuideProgress): GuideView {
  let doneTokens = 0;
  while (doneTokens < plan.tokens.length && plan.tokenEnds[doneTokens] <= progress.step) doneTokens++;
  const step = plan.steps[progress.step];
  const frame = step?.frame ?? plan.finalFrame;
  let remaining = '';
  if (step && Object.values(progress.acc).some((n) => n !== 0)) {
    remaining = (Object.entries(step.turns) as [Face, Amount][])
      .map(([face, n]) => [face, mod4(n - (progress.acc[face] ?? 0))] as const)
      .filter(([, n]) => n !== 0)
      .map(([face, n]) => userNotation(frame, face, n as Amount))
      .join(' ');
  }
  const undo = [...progress.wrong].reverse()
    .map((w) => userNotation(frame, w.face, mod4(-w.amount) as Amount))
    .join(' ');
  return { doneTokens, remaining, undo };
}
