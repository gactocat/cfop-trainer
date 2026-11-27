// One solve from a scramble on a smart cube, as a pure state machine:
//   scramble -> ready -> running -> done
// The scramble is guided turn by turn (setup-guide.ts) from a solved cube.
// When the cube is not solved at the start, or the turns stray too far from
// the guide (or the tracked state stops matching it), the route to the
// scrambled state is worked out again from where the cube is: the caller
// asks the two-phase solver (`needsRoute`) and hands the answer to
// `withRoute`. The cube in the scrambled state is ready; its first turn
// starts the timer and reaching the goal stops it: solved, or for a part of
// CFOP solved on its own, a cross or the first two layers (solve-goal.ts).
// Times are cube-clock ms.

import { SOLVED, stateEquals, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { toFrame, userNotation, type CubeHolding, type Frame } from '@/lib/smart-cube/holding';
import { nextGuideMove, type NextMove } from '@/lib/smart-cube/guide-cube';
import { mergeTurns } from '@/lib/smart-cube/solve-record';
import {
  advanceGuide,
  applyPlan,
  expectedState,
  GUIDE_START,
  guideView,
  planSetup,
  type GuideProgress,
  type GuideView,
  type SetupPlan,
} from '@/lib/smart-cube/setup-guide';
import { scrambleState } from '@/lib/solve/scramble';
import { goalReached, SOLVED_GOAL, type SolveGoal } from '@/lib/solve/solve-goal';

export type CubeSolvePhase = 'scramble' | 'ready' | 'running' | 'done';

/** After this many wrong turns in a row (one face's turns merged) the route is worked out again. */
export const WRONG_TURNS_BEFORE_REROUTE = 3;

export interface SolveRoute {
  /** The turns, in the user's notation. */
  moves: string;
  plan: SetupPlan;
  /** The state the route starts from. */
  base: CubeState;
  /** The scramble itself from a solved cube, or a route worked out from another state. */
  kind: 'scramble' | 'reroute';
}

export interface CubeSolveTurn {
  face: Face;
  amount: 1 | 3;
  /** Cube clock, ms. */
  cubeTime: number;
  /** State after the turn. */
  state: CubeState;
}

export interface CubeSolveSession {
  /** How the user holds the cube: the scramble and routes are turned in it. */
  holding: Frame;
  scramble: string;
  /** The scrambled state, in the cube's frame. */
  target: CubeState;
  /** The cube's state as last reported. */
  state: CubeState;
  phase: CubeSolvePhase;
  /** Null while waiting for a route from the solver. */
  route: SolveRoute | null;
  /**
   * While waiting: a route known without the solver (the wrong turns taken
   * back, then the rest of the old route), kept unless the solver's is shorter.
   */
  fallback: string | null;
  progress: GuideProgress;
  /** What stops the timer: solved unless a mode sets another goal. */
  goal: SolveGoal;
  /** Solving turns, first to last. */
  turns: CubeSolveTurn[];
  elapsedMs: number | null;
}

export type CubeSolveEvent = 'ready' | 'start' | 'stop' | null;

function routeOf(moves: string, holding: Frame, base: CubeState, kind: SolveRoute['kind']): SolveRoute {
  const plan = planSetup(moves, holding);
  if (!plan) throw new Error(`Not a route: ${moves}`);
  return { moves, plan, base, kind };
}

/** Guide from `state`: the scramble itself from a solved cube; otherwise wait for a worked-out route. */
function guideFrom(session: CubeSolveSession, state: CubeState, fallback: string | null = null): CubeSolveSession {
  if (stateEquals(state, session.target)) return { ...session, state, phase: 'ready', route: null, fallback: null, progress: GUIDE_START };
  const route = stateEquals(state, SOLVED) ? routeOf(session.scramble, session.holding, SOLVED, 'scramble') : null;
  return { ...session, state, phase: 'scramble', route, fallback: route ? null : fallback, progress: GUIDE_START };
}

const mod4 = (n: number) => ((n % 4) + 4) % 4;

/** From where the guide stands: take back the wrong turns, then finish the route. */
function undoThenRest(route: SolveRoute, progress: GuideProgress, holding: Frame): string {
  const turns: { face: Face; amount: number }[] = [...progress.wrong].reverse().map((w) => ({ face: w.face, amount: mod4(-w.amount) }));
  route.plan.steps.slice(progress.step).forEach((step, i) => {
    for (const [face, amount] of Object.entries(step.turns) as [Face, number][]) {
      const left = mod4(amount - (i === 0 ? progress.acc[face] ?? 0 : 0));
      if (left) turns.push({ face, amount: left });
    }
  });
  return mergeTurns(turns).map((t) => userNotation(holding, t.face, t.amount)).join(' ');
}

const moveCount = (moves: string) => moves.split(' ').filter(Boolean).length;

/**
 * A solve of `scramble` turned holding the cube as `held`, from the cube in
 * `state`, timed until `goal` (solved unless given). The scramble must not
 * reach the goal within one turn (mode-scramble.ts makes sure): the first
 * turn only starts the timer.
 */
export function startCubeSolve(scramble: string, held: CubeHolding | Frame, state: CubeState, goal: SolveGoal = SOLVED_GOAL): CubeSolveSession {
  const holding = toFrame(held);
  const session: CubeSolveSession = {
    holding, scramble, target: scrambleState(scramble, holding), state, phase: 'scramble',
    route: null, fallback: null, progress: GUIDE_START, goal, turns: [], elapsedMs: null,
  };
  return guideFrom(session, state);
}

/** The same scramble, holding and goal guided again from `state` (an abandoned attempt). */
export const restartCubeSolve = (session: CubeSolveSession, state: CubeState): CubeSolveSession =>
  startCubeSolve(session.scramble, session.holding, state, session.goal);

/** The session waits for a route from its current state to the target. */
export const needsRoute = (session: CubeSolveSession) => session.phase === 'scramble' && session.route === null;

/**
 * A route the solver found from `from` (null: none), or the fallback when
 * that is shorter; ignored when the cube has moved on since.
 */
export function withRoute(session: CubeSolveSession, from: CubeState, moves: string | null): CubeSolveSession {
  if (!needsRoute(session) || !stateEquals(session.state, from)) return session;
  // Only routes that lead to this session's scrambled state (an answer for an earlier scramble does not).
  const leads = (route: string | null) => {
    const plan = route === null ? null : planSetup(route, session.holding);
    return plan !== null && stateEquals(applyPlan(from, plan), session.target);
  };
  const solver = leads(moves) ? moves : null;
  const fallback = leads(session.fallback) ? session.fallback : null;
  const best = solver === null || (fallback !== null && moveCount(fallback) <= moveCount(solver)) ? fallback : solver;
  if (best === null) return session;
  return { ...session, route: routeOf(best, session.holding, from, 'reroute'), fallback: null, progress: GUIDE_START };
}

export function cubeSolveTurn(session: CubeSolveSession, turn: CubeSolveTurn): { session: CubeSolveSession; event: CubeSolveEvent } {
  const state = turn.state;
  switch (session.phase) {
    case 'scramble': {
      if (stateEquals(state, session.target)) {
        const progress = session.route ? { step: session.route.plan.steps.length, acc: {}, wrong: [] } : GUIDE_START;
        return { session: { ...session, state, phase: 'ready', progress }, event: 'ready' };
      }
      if (!session.route) return { session: guideFrom(session, state), event: null };
      const progress = advanceGuide(session.route.plan, session.progress, turn.face, turn.amount);
      const tracked = stateEquals(state, expectedState(session.route.base, session.route.plan, progress));
      if (!tracked) return { session: guideFrom(session, state), event: null };
      if (progress.wrong.length >= WRONG_TURNS_BEFORE_REROUTE) {
        return { session: guideFrom(session, state, undoThenRest(session.route, progress, session.holding)), event: null };
      }
      return { session: { ...session, state, progress }, event: null };
    }
    case 'ready':
      return { session: { ...session, state, phase: 'running', turns: [turn] }, event: 'start' };
    case 'running': {
      const turns = [...session.turns, turn];
      if (!goalReached(session.goal, state)) return { session: { ...session, state, turns }, event: null };
      return { session: { ...session, state, turns, phase: 'done', elapsedMs: turn.cubeTime - turns[0].cubeTime }, event: 'stop' };
    }
    case 'done':
      return { session: { ...session, state }, event: null };
  }
}

/**
 * The cube's state changed without a turn (a resync from the cube, or a
 * reconnection): guide again from there if it no longer fits.
 */
export function cubeSolveResync(session: CubeSolveSession, state: CubeState): CubeSolveSession {
  if (stateEquals(state, session.state)) return session;
  switch (session.phase) {
    case 'scramble': {
      if (session.route && stateEquals(state, expectedState(session.route.base, session.route.plan, session.progress))) {
        return { ...session, state };
      }
      return guideFrom(session, state);
    }
    case 'ready':
      return guideFrom(session, state);
    default:
      return { ...session, state };
  }
}

export interface CubeSolveView extends GuideView {
  phase: CubeSolvePhase;
  /** The route's tokens as shown; empty while waiting for one. */
  tokens: string[];
  routeKind: SolveRoute['kind'] | null;
  /** Solving turns so far. */
  turnCount: number;
  /** The next move of the route, shown on the 3D cube; none while waiting for a route. */
  nextMove: NextMove;
}

export function cubeSolveView(session: CubeSolveSession): CubeSolveView {
  const route = session.route;
  const guide = route ? guideView(route.plan, session.progress) : { doneTokens: 0, remaining: '', undo: '' };
  return {
    phase: session.phase,
    tokens: route?.plan.tokens ?? [],
    routeKind: route?.kind ?? null,
    turnCount: session.turns.length,
    ...guide,
    nextMove: route && session.phase === 'scramble' ? nextGuideMove(route.plan, session.progress) : { frame: session.holding, alg: '' },
  };
}
