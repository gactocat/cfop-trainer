'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useKeepAwake } from '@/hooks/useNativeTimer';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { canWriteData } from '@/lib/persistence';
import type { PracticeCase, PracticeLog } from '@/lib/practice-log';
import type { Face } from '@/lib/smart-cube/cube-state';
import { displayRotation, type CubeHolding } from '@/lib/smart-cube/holding';
import { mergeTurns, turnsPerSecond } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';
import {
  RESET_TURNS,
  isResetGesture,
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

export { SETTLE_MS } from '@/lib/practice-log';

export interface NoScrambleView {
  practice: TrainerPractice;
  holding: CubeHolding;
  phase: VirtualPhase;
  /** cubing.js setup that shows the case in the chosen holding. */
  setupAlg: string;
  /** Turns made on the virtual cube since the case was shown, user notation. */
  moves: string[];
  /** Changes whenever the virtual cube jumps (new case or reset) instead of turning. */
  resetKey: number;
  /** Host time (performance.now()) the case was shown: recognition runs from here to the first turn. */
  shownAt: number;
  recognitionMs: number | null;
  /** The attempt the cube timed, once it stopped. */
  solve: SmartSolve | null;
}

export type NoScrambleCase = PracticeCase;

class VirtualHolder {
  session: VirtualSession | null = null;
  private view: NoScrambleView | null = null;
  private resets = 0;
  /** Recent turns, for the reset gesture. */
  recent: { face: Face; amount: 1 | 3; at: number }[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.view;

  set(session: VirtualSession | null, jumped: boolean) {
    if (session === this.session) return;
    if (jumped) {
      this.resets++;
      this.recent = [];
    }
    this.session = session;
    this.view = session && {
      practice: session.practice,
      holding: session.holding,
      phase: session.phase,
      setupAlg: `${displayRotation(session.holding)} ${session.plan.tokens.join(' ')}`.trim(),
      moves: virtualNotation(session),
      resetKey: this.resets,
      shownAt: session.shownAt,
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
 * timer and reaching the practice's goal stops it. A solve is recorded in
 * `log` as soon as it stops (undo takes it back). The next case comes with
 * `next`, or, with `autoAdvance`, by itself once the cube has been still for
 * SETTLE_MS. Turning one face the same way four times in a row starts the
 * case again.
 */
export function useNoScrambleTrainer({
  active, practice, scramble, trainerState, autoAdvance, log, describe, record, onStart, onStop, onAbort, onAdvance,
}: {
  active: boolean;
  /** Go on to the next case by itself once the cube rests; otherwise wait for `next`. */
  autoAdvance: boolean;
  practice: TrainerPractice;
  /** The case's setup in the user's notation, as the trainer built it. */
  scramble: string | null;
  trainerState: TrainerState;
  /** This session's solves. */
  log: PracticeLog;
  /** The case on screen, read when it is solved. */
  describe: () => NoScrambleCase | null;
  /** Record a solve; returns how to take it back, or null when nothing was recorded. */
  record: (caseId: string, seconds: number, solve: SmartSolve | null) => (() => void) | null;
  onStart: () => void;
  /**
   * The attempt stopped: seconds on the cube clock, or null when the trainer
   * times it itself. Returns the seconds the trainer settled on.
   */
  onStop: (seconds: number | null) => number;
  /** The attempt was reset while timing: go back to the start screen with the same case. */
  onAbort: () => void;
  /** Show the next case. */
  onAdvance: () => void;
}): {
  view: NoScrambleView | null;
  connected: boolean;
  reset: () => void;
  stopByHand: () => void;
  next: () => void;
} {
  const cube = useSmartCube();
  const { holding } = useSmartCubeSettings();
  const connected = cube.status === 'connected';
  const [holder] = useState(() => new VirtualHolder());
  const view = useSyncExternalStore(holder.subscribe, holder.getSnapshot, serverView);
  const callbacks = useRef({ autoAdvance, describe, record, onStart, onStop, onAbort, onAdvance });
  useEffect(() => { callbacks.current = { autoAdvance, describe, record, onStart, onStop, onAbort, onAdvance }; });
  // The phone is put down while practising, so keep its screen on.
  useKeepAwake(active && connected);

  // A new case (or holding) shows a fresh virtual cube; the trainer's own
  // start and stop (tap, Space) are mirrored into the attempt.
  useEffect(() => {
    if (!active || !scramble) {
      // The log may belong to the with-setup practice while this one is off.
      if (active) log.clearSettle();
      holder.set(null, true);
    } else if (trainerState === 'idle') {
      log.clearSettle();
      holder.set(startVirtual(practice, holding, scramble, performance.now()), true);
    } else if (holder.session) {
      holder.set(trainerState === 'running' ? manualStartVirtual(holder.session) : manualStopVirtual(holder.session), false);
    }
  }, [holder, log, active, practice, holding, scramble, trainerState]);

  // The attempt just stopped: record it and wait for the cube to rest.
  const finish = (cubeSeconds: number | null) => {
    const session = holder.session;
    if (!session) return;
    const seconds = callbacks.current.onStop(cubeSeconds);
    const info = callbacks.current.describe();
    const solve = holder.getSnapshot()?.solve ?? null;
    if (info && seconds > 0) {
      const undo = callbacks.current.record(info.caseId, seconds, solve);
      const moveCount = solve ? mergeTurns(solve.turns).length : null;
      log.add({
        ...info,
        seconds,
        recognitionMs: session.recognitionMs,
        moveCount,
        tps: solve && moveCount !== null ? turnsPerSecond(moveCount, solve.executionMs) : null,
      }, undo);
    }
    if (callbacks.current.autoAdvance) log.startSettle(() => callbacks.current.onAdvance());
  };
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });

  const reset = () => {
    const session = holder.session;
    if (!session || session.phase === 'done') return;
    const timing = session.phase === 'running';
    holder.set(resetVirtual(session, performance.now()), true);
    if (timing) callbacks.current.onAbort();
  };
  const resetRef = useRef(reset);
  useEffect(() => { resetRef.current = reset; });

  useEffect(() => {
    if (!active || !connected) return;
    return subscribeTurns((turn) => {
      const session = holder.session;
      if (!session) return;
      // Not while a dialog covers the trainer or data cannot be written (as for Space).
      if (!canWriteData() || document.querySelector('[data-app-overlay]')) return;
      // Turns after the stop (a last AUF, setting the cube down) only delay an automatic next case.
      if (session.phase === 'done') {
        if (log.settling) log.startSettle(() => callbacks.current.onAdvance());
        return;
      }
      holder.recent = [...holder.recent.slice(-(RESET_TURNS - 1)), { face: turn.face, amount: turn.amount, at: turn.hostTime }];
      const result = virtualMove(session, turn);
      holder.set(result.session, false);
      if (result.event === 'start') callbacks.current.onStart();
      if (result.session.phase === 'done' && (result.event === 'stop' || result.event === 'start')) {
        finishRef.current(result.session.elapsedMs === null ? null : result.session.elapsedMs / 1000);
      } else if (result.session.phase === 'running' && isResetGesture(holder.recent)) {
        resetRef.current();
      }
    });
  }, [holder, log, active, connected]);

  const stopByHand = () => {
    const session = holder.session;
    if (!session || session.phase !== 'running') return;
    holder.set(manualStopVirtual(session), false);
    finish(null);
  };

  const next = () => {
    if (holder.session?.phase !== 'done') return;
    log.clearSettle();
    callbacks.current.onAdvance();
  };

  return { view: active ? view : null, connected, reset, stopByHand, next };
}
