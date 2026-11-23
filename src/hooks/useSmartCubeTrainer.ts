'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { canWriteData } from '@/lib/persistence';
import { lastLayerFace, type CubeHolding } from '@/lib/smart-cube/holding';
import { buildSmartSolve, type SmartSolveMode } from '@/lib/smart-cube/solve-record';
import { guideView, planSetup, type SetupPlan } from '@/lib/smart-cube/setup-guide';
import {
  manualStart,
  manualStop,
  sessionMove,
  startSession,
  type SessionPhase,
  type SolveTurn,
  type TrainerPractice,
  type TrainerSession,
} from '@/lib/smart-cube/trainer-session';
import { getSnapshot as getCubeSnapshot, subscribeTurns } from '@/lib/smart-cube-store';
import { addSmartSolve } from '@/lib/smart-solve-store';

type TrainerState = 'idle' | 'running' | 'stopped';

export interface SmartTrainerView {
  phase: SessionPhase;
  plan: SetupPlan;
  /** Setup tokens done, from the start. */
  doneTokens: number;
  /** Turns left on a half-done setup step, in the user's notation. */
  remaining: string;
  /** Turns that take back wrong ones, in the user's notation. */
  undo: string;
  /** Ready to first turn, ms on the cube clock. */
  recognitionMs: number | null;
  /** The attempt the cube timed from first turn to goal, once stopped. */
  solve: SmartSolve | null;
}

export interface SmartSolve {
  practice: TrainerPractice;
  holding: CubeHolding;
  scramble: string;
  turns: SolveTurn[];
  recognitionMs: number | null;
  executionMs: number;
  /** Absent means inverse setup. */
  mode?: SmartSolveMode;
}

/** Keep a cube-timed solve on this device (when the user records the time). */
export function recordSmartSolve(solve: SmartSolve, caseId: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  addSmartSolve(buildSmartSolve({ ...solve, id, caseId, recordedAt: new Date().toISOString() })).catch(() => {
    // Storage unavailable or full: the time itself is still recorded.
  });
}

// Per-trainer holder for the current attempt, read with useSyncExternalStore.
class SessionHolder {
  session: TrainerSession | null = null;
  holding: CubeHolding = 'yellow-blue';
  private view: SmartTrainerView | null = null;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.view;
  set(session: TrainerSession | null, holding = this.holding) {
    if (session === this.session && holding === this.holding) return;
    this.session = session;
    this.holding = holding;
    this.view = session && {
      phase: session.phase,
      plan: session.plan,
      recognitionMs: session.recognitionMs,
      ...guideView(session.plan, session.progress),
      solve: session.phase === 'done' && session.elapsedMs !== null && session.solveTurns.length > 0
        ? {
          practice: session.practice,
          holding: this.holding,
          scramble: session.plan.tokens.join(' '),
          turns: session.solveTurns,
          recognitionMs: session.recognitionMs,
          executionMs: session.elapsedMs,
        }
        : null,
    };
    this.listeners.forEach((l) => l());
  }
}

const serverView = () => null;

/**
 * Follow the inverse setup on a connected smart cube: guide the setup, start
 * the timer with the first turn after it, and stop it when the practice's goal
 * is reached. Returns null when no cube is connected or there is no setup, so
 * the trainer behaves exactly as without a cube.
 */
export function useSmartCubeTrainer({ practice, scramble, trainerState, onStart, onStop }: {
  practice: TrainerPractice;
  /** The setup shown on the start screen; null outside inverse mode. */
  scramble: string | null;
  trainerState: TrainerState;
  onStart: () => void;
  /** Elapsed seconds on the cube clock, or null when the trainer should time it itself. */
  onStop: (seconds: number | null) => void;
}): SmartTrainerView | null {
  const cube = useSmartCube();
  const { holding } = useSmartCubeSettings();
  const connected = cube.status === 'connected';
  const synced = cube.state !== null;
  const plan = useMemo(() => (connected && scramble ? planSetup(scramble, holding) : null), [connected, scramble, holding]);
  const ll = lastLayerFace(holding);
  const [holder] = useState(() => new SessionHolder());
  const view = useSyncExternalStore(holder.subscribe, holder.getSnapshot, serverView);
  const callbacks = useRef({ onStart, onStop });
  useEffect(() => { callbacks.current = { onStart, onStop }; });

  // A new attempt begins with each case, holding or connection; the trainer's
  // own start and stop (tap, Space) are mirrored into the session.
  useEffect(() => {
    if (!plan) holder.set(null, holding);
    else if (trainerState === 'idle') holder.set(startSession(practice, ll, plan, getCubeSnapshot().state), holding);
    else if (holder.session) holder.set(trainerState === 'running' ? manualStart(holder.session) : manualStop(holder.session), holding);
  }, [holder, plan, practice, ll, holding, trainerState, synced]);

  useEffect(() => {
    if (!plan) return;
    return subscribeTurns((turn) => {
      const session = holder.session;
      if (!session) return;
      const result = sessionMove(session, turn);
      // Not while a dialog covers the trainer or data cannot be written (as for Space).
      if (result.event === 'start' && (!canWriteData() || document.querySelector('[data-app-overlay]'))) {
        holder.set(startSession(session.practice, session.ll, session.plan, turn.state));
        return;
      }
      holder.set(result.session);
      if (result.event === 'start') callbacks.current.onStart();
      if (result.event === 'stop') {
        callbacks.current.onStop(result.session.elapsedMs === null ? null : result.session.elapsedMs / 1000);
      }
    });
  }, [holder, plan]);

  return plan ? view : null;
}
