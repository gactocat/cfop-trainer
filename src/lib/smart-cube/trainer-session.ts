// One inverse-setup attempt on a smart cube, as a pure state machine:
//   need-base -> setup -> ready -> running -> done
// The base is the state the setup starts from, which is also the goal of the
// practice (F2L solved, last layer oriented, solved apart from the final AUF),
// so finishing one case leaves the cube ready for the next setup.
// Times are cube-clock milliseconds.

import {
  isF2LSolved,
  isLastLayerOriented,
  isSolvedUpToLastLayerTurn,
  stateEquals,
  type CubeState,
  type Face,
  type LastLayerFace,
} from '@/lib/smart-cube/cube-state';
import { advanceGuide, applyPlan, expectedState, GUIDE_START, isGuideComplete, type GuideProgress, type SetupPlan } from '@/lib/smart-cube/setup-guide';

export type TrainerPractice = 'f2l' | 'oll' | 'pll';
export type SessionPhase = 'need-base' | 'setup' | 'ready' | 'running' | 'done';

/** The practice's goal, which is also where its setup starts. */
export function isPracticeGoal(practice: TrainerPractice, state: CubeState, ll: LastLayerFace): boolean {
  if (practice === 'f2l') return isF2LSolved(state, ll);
  if (practice === 'oll') return isLastLayerOriented(state, ll);
  return isSolvedUpToLastLayerTurn(state, ll);
}

export interface TrainerSession {
  practice: TrainerPractice;
  ll: LastLayerFace;
  plan: SetupPlan;
  phase: SessionPhase;
  progress: GuideProgress;
  base: CubeState | null;
  target: CubeState | null;
  readyAt: number | null;
  /** Cube time of the first solving turn; null when the timer was started by hand. */
  startAt: number | null;
  recognitionMs: number | null;
  elapsedMs: number | null;
  /** Turns from the first solving turn to the one that reached the goal. */
  solveTurns: SolveTurn[];
}

export interface SolveTurn {
  face: Face;
  amount: 1 | 3;
  /** Cube clock, ms. */
  cubeTime: number;
}

export interface SessionMove {
  face: Face;
  /** A reported turn is a quarter turn: 1 clockwise, 3 counter-clockwise. */
  amount: 1 | 3;
  /** Cube clock, ms. */
  cubeTime: number;
  /** State after the turn. */
  state: CubeState;
}

export type SessionEvent = 'ready' | 'start' | 'stop' | null;

function withBase(session: TrainerSession, base: CubeState): TrainerSession {
  return { ...session, phase: 'setup', base, target: applyPlan(base, session.plan), progress: GUIDE_START, readyAt: null };
}

export function startSession(
  practice: TrainerPractice,
  ll: LastLayerFace,
  plan: SetupPlan,
  state: CubeState | null,
): TrainerSession {
  const session: TrainerSession = {
    practice, ll, plan, phase: 'need-base', progress: GUIDE_START, base: null, target: null,
    readyAt: null, startAt: null, recognitionMs: null, elapsedMs: null, solveTurns: [],
  };
  return state && isPracticeGoal(practice, state, ll) ? withBase(session, state) : session;
}

export function sessionMove(session: TrainerSession, move: SessionMove): { session: TrainerSession; event: SessionEvent } {
  const goal = isPracticeGoal(session.practice, move.state, session.ll);
  switch (session.phase) {
    case 'need-base':
      return { session: goal ? withBase(session, move.state) : session, event: null };
    case 'setup': {
      const progress = advanceGuide(session.plan, session.progress, move.face, move.amount);
      const next = { ...session, progress };
      // Ready only at the end of the guided setup: the state can pass through
      // the target earlier when the remaining turns happen to cancel out.
      if (next.target && isGuideComplete(session.plan, progress) && stateEquals(move.state, next.target)) {
        return { session: { ...next, phase: 'ready', readyAt: move.cubeTime }, event: 'ready' };
      }
      // Back at a starting state after wrong turns (or out of step with the
      // cube, e.g. after a missed turn): start the setup again from here.
      // A pre-turn of the last layer is absorbed the same way.
      const consistent = session.base !== null && stateEquals(move.state, expectedState(session.base, session.plan, progress));
      if (goal && (progress.wrong.length > 0 || !consistent)) return { session: withBase(next, move.state), event: null };
      return { session: next, event: null };
    }
    case 'ready':
      return {
        session: {
          ...session,
          phase: 'running',
          startAt: move.cubeTime,
          recognitionMs: move.cubeTime - (session.readyAt ?? move.cubeTime),
          solveTurns: [turnOf(move)],
        },
        event: 'start',
      };
    case 'running': {
      const solveTurns = [...session.solveTurns, turnOf(move)];
      if (!goal) return { session: { ...session, solveTurns }, event: null };
      return {
        session: { ...session, phase: 'done', solveTurns, elapsedMs: session.startAt === null ? null : move.cubeTime - session.startAt },
        event: 'stop',
      };
    }
    case 'done':
      return { session, event: null };
  }
}

const turnOf = (move: SessionMove): SolveTurn => ({ face: move.face, amount: move.amount, cubeTime: move.cubeTime });

/** The timer was started without a cube turn (tap or Space). */
export function manualStart(session: TrainerSession): TrainerSession {
  return session.phase === 'running' || session.phase === 'done' ? session : { ...session, phase: 'running', startAt: null, recognitionMs: null, solveTurns: [] };
}

/** The timer was stopped by hand. */
export function manualStop(session: TrainerSession): TrainerSession {
  return session.phase === 'done' ? session : { ...session, phase: 'done' };
}
