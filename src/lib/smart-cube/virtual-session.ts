// No-scramble attempt: the case lives on a virtual cube built from the
// trainer's setup, and the smart cube's turns move that virtual cube instead
// of a physically set-up one. The physical cube's own state is ignored.
//   ready -> running -> done
// Times: start and stop on the cube clock; recognition (case shown to first
// turn) on the host clock, since the case appears on screen, not on the cube.

import { applyTurn, SOLVED, type CubeState, type Face, type LastLayerFace } from '@/lib/smart-cube/cube-state';
import { applyPlan, planSetup, type SetupPlan } from '@/lib/smart-cube/setup-guide';
import { lastLayerFace, userNotation, type CubeHolding } from '@/lib/smart-cube/holding';
import { isPracticeGoal, type SolveTurn, type TrainerPractice } from '@/lib/smart-cube/trainer-session';

export type VirtualPhase = 'ready' | 'running' | 'done';

export interface VirtualSession {
  practice: TrainerPractice;
  holding: CubeHolding;
  ll: LastLayerFace;
  plan: SetupPlan;
  /** The case: the setup applied to a solved cube. */
  caseState: CubeState;
  /** The virtual cube now. */
  state: CubeState;
  /** Turns applied since the case was shown, for the display. */
  turns: { face: Face; amount: 1 | 3 }[];
  phase: VirtualPhase;
  /** Host time the case was shown. */
  shownAt: number;
  /** Cube time of the first solving turn; null when started by hand. */
  startAt: number | null;
  recognitionMs: number | null;
  elapsedMs: number | null;
  solveTurns: SolveTurn[];
}

export interface VirtualTurn {
  face: Face;
  amount: 1 | 3;
  cubeTime: number;
  hostTime: number;
}

/** A fresh attempt on the case; null when the setup cannot be planned. */
export function startVirtual(practice: TrainerPractice, holding: CubeHolding, scramble: string, shownAt: number): VirtualSession | null {
  const plan = planSetup(scramble, holding);
  if (!plan) return null;
  const caseState = applyPlan(SOLVED, plan);
  return {
    practice, holding, ll: lastLayerFace(holding), plan, caseState, state: caseState, turns: [],
    phase: 'ready', shownAt, startAt: null, recognitionMs: null, elapsedMs: null, solveTurns: [],
  };
}

/** Put the virtual cube back to the case, as a new attempt. */
export function resetVirtual(session: VirtualSession, shownAt: number): VirtualSession {
  return {
    ...session, state: session.caseState, turns: [], phase: 'ready', shownAt,
    startAt: null, recognitionMs: null, elapsedMs: null, solveTurns: [],
  };
}

export function virtualMove(session: VirtualSession, turn: VirtualTurn): { session: VirtualSession; event: 'start' | 'stop' | null } {
  if (session.phase === 'done') return { session, event: null };
  const state = applyTurn(session.state, turn.face, turn.amount);
  const turns = [...session.turns, { face: turn.face, amount: turn.amount }];
  const solveTurn: SolveTurn = { face: turn.face, amount: turn.amount, cubeTime: turn.cubeTime };
  const goal = isPracticeGoal(session.practice, state, session.ll);
  if (session.phase === 'ready') {
    const started: VirtualSession = {
      ...session, state, turns, phase: 'running', startAt: turn.cubeTime,
      recognitionMs: Math.max(0, Math.round(turn.hostTime - session.shownAt)), solveTurns: [solveTurn],
    };
    // A one-turn case is solved by the turn that starts it.
    return goal ? { session: { ...started, phase: 'done', elapsedMs: 0 }, event: 'start' } : { session: started, event: 'start' };
  }
  const solveTurns = [...session.solveTurns, solveTurn];
  if (!goal) return { session: { ...session, state, turns, solveTurns }, event: null };
  return {
    session: { ...session, state, turns, solveTurns, phase: 'done', elapsedMs: session.startAt === null ? null : turn.cubeTime - session.startAt },
    event: 'stop',
  };
}

/** The timer was started by hand (tap or Space). */
export function manualStartVirtual(session: VirtualSession): VirtualSession {
  return session.phase === 'ready' ? { ...session, phase: 'running', startAt: null, recognitionMs: null, solveTurns: [] } : session;
}

/** The timer was stopped by hand. */
export function manualStopVirtual(session: VirtualSession): VirtualSession {
  return session.phase === 'done' ? session : { ...session, phase: 'done' };
}

/** Turns made on the virtual cube, in the user's notation. */
export function virtualNotation(session: VirtualSession): string[] {
  return session.turns.map((t) => userNotation(session.plan.finalFrame, t.face, t.amount));
}
