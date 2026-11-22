'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import { canWriteData } from '@/lib/persistence';
import { lastLayerFace } from '@/lib/smart-cube/holding';
import { guideView, planSetup, type SetupPlan } from '@/lib/smart-cube/setup-guide';
import {
  manualStart,
  manualStop,
  sessionMove,
  startSession,
  type SessionPhase,
  type TrainerPractice,
  type TrainerSession,
} from '@/lib/smart-cube/trainer-session';
import { getSnapshot as getCubeSnapshot, subscribeTurns } from '@/lib/smart-cube-store';

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
}

// Per-trainer holder for the current attempt, read with useSyncExternalStore.
class SessionHolder {
  session: TrainerSession | null = null;
  private view: SmartTrainerView | null = null;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.view;
  set(session: TrainerSession | null) {
    if (session === this.session) return;
    this.session = session;
    this.view = session && { phase: session.phase, plan: session.plan, recognitionMs: session.recognitionMs, ...guideView(session.plan, session.progress) };
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
    if (!plan) holder.set(null);
    else if (trainerState === 'idle') holder.set(startSession(practice, ll, plan, getCubeSnapshot().state));
    else if (holder.session) holder.set(trainerState === 'running' ? manualStart(holder.session) : manualStop(holder.session));
  }, [holder, plan, practice, ll, trainerState, synced]);

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
