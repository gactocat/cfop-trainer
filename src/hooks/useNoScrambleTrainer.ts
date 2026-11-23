'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { canWriteData } from '@/lib/persistence';
import { displayRotation } from '@/lib/smart-cube/holding';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import {
  manualStartVirtual,
  manualStopVirtual,
  resetVirtual,
  startVirtual,
  virtualMove,
  virtualNotation,
  type VirtualPhase,
  type VirtualSession,
} from '@/lib/smart-cube/virtual-session';
import { subscribeTurns } from '@/lib/smart-cube-store';

type TrainerState = 'idle' | 'running' | 'stopped';

export interface NoScrambleView {
  phase: VirtualPhase;
  /** cubing.js setup that shows the case in the chosen holding. */
  setupAlg: string;
  /** Turns made on the virtual cube since the case was shown, user notation. */
  moves: string[];
  /** Changes whenever the virtual cube jumps (new case or reset) instead of turning. */
  resetKey: number;
  recognitionMs: number | null;
  /** The attempt the cube timed, once it stopped. */
  solve: SmartSolve | null;
}

class VirtualHolder {
  session: VirtualSession | null = null;
  private view: NoScrambleView | null = null;
  private resets = 0;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.view;
  set(session: VirtualSession | null, jumped: boolean) {
    if (session === this.session) return;
    if (jumped) this.resets++;
    this.session = session;
    this.view = session && {
      phase: session.phase,
      setupAlg: `${displayRotation(session.holding)} ${session.plan.tokens.join(' ')}`.trim(),
      moves: virtualNotation(session),
      resetKey: this.resets,
      recognitionMs: session.recognitionMs,
      solve: session.phase === 'done' && session.elapsedMs !== null && session.solveTurns.length > 0
        ? {
          practice: session.practice,
          holding: session.holding,
          scramble: session.plan.tokens.join(' '),
          turns: session.solveTurns,
          recognitionMs: session.recognitionMs,
          executionMs: session.elapsedMs,
          mode: 'no-scramble' as const,
        }
        : null,
    };
    this.listeners.forEach((l) => l());
  }
}

const serverView = () => null;

/**
 * No-scramble mode: the case is shown on a virtual cube built from the
 * trainer's setup, the smart cube's turns move it, the first turn starts the
 * timer and reaching the practice's goal stops it. Returns null when the mode
 * is off or there is no case.
 */
export function useNoScrambleTrainer({ active, practice, scramble, trainerState, onStart, onStop, onAbort }: {
  active: boolean;
  practice: TrainerPractice;
  /** The case's setup in the user's notation, as the trainer built it. */
  scramble: string | null;
  trainerState: TrainerState;
  onStart: () => void;
  /** Elapsed seconds on the cube clock, or null when the trainer should time it itself. */
  onStop: (seconds: number | null) => void;
  /** The attempt was reset while timing: go back to the start screen with the same case. */
  onAbort: () => void;
}): { view: NoScrambleView | null; connected: boolean; reset: () => void } {
  const cube = useSmartCube();
  const { holding } = useSmartCubeSettings();
  const connected = cube.status === 'connected';
  const [holder] = useState(() => new VirtualHolder());
  const view = useSyncExternalStore(holder.subscribe, holder.getSnapshot, serverView);
  const callbacks = useRef({ onStart, onStop, onAbort });
  useEffect(() => { callbacks.current = { onStart, onStop, onAbort }; });

  // A new case (or holding) shows a fresh virtual cube; the trainer's own
  // start and stop (tap, Space) are mirrored into the attempt.
  useEffect(() => {
    if (!active || !scramble) holder.set(null, true);
    else if (trainerState === 'idle') holder.set(startVirtual(practice, holding, scramble, performance.now()), true);
    else if (holder.session) {
      holder.set(trainerState === 'running' ? manualStartVirtual(holder.session) : manualStopVirtual(holder.session), false);
    }
  }, [holder, active, practice, holding, scramble, trainerState]);

  useEffect(() => {
    if (!active || !connected) return;
    return subscribeTurns((turn) => {
      const session = holder.session;
      if (!session) return;
      // Not while a dialog covers the trainer or data cannot be written (as for Space).
      if (!canWriteData() || document.querySelector('[data-app-overlay]')) return;
      const result = virtualMove(session, turn);
      holder.set(result.session, false);
      if (result.event === 'start') callbacks.current.onStart();
      if (result.session.phase === 'done' && (result.event === 'stop' || result.event === 'start')) {
        callbacks.current.onStop(result.session.elapsedMs === null ? null : result.session.elapsedMs / 1000);
      }
    });
  }, [holder, active, connected]);

  const reset = () => {
    const session = holder.session;
    if (!session) return;
    const timing = session.phase === 'running';
    holder.set(resetVirtual(session, performance.now()), true);
    if (timing) callbacks.current.onAbort();
  };

  return { view: active ? view : null, connected, reset };
}
