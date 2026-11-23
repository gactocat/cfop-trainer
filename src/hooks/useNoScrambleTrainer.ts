'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useKeepAwake } from '@/hooks/useNativeTimer';
import { useSmartCube, useSmartCubeSettings } from '@/hooks/useSmartCube';
import type { SmartSolve } from '@/hooks/useSmartCubeTrainer';
import { canWriteData } from '@/lib/persistence';
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

/** After a solve, the next case comes once the cube has been still this long. */
export const SETTLE_MS = 1500;

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
  recognitionMs: number | null;
  /** The attempt the cube timed, once it stopped. */
  solve: SmartSolve | null;
}

/** What the trainer knows about the case on screen, read when it is solved. */
export interface NoScrambleCase {
  caseId: string;
  name: string;
  solution: string;
}

/** One solve of this session, newest first in `results`. */
export interface NoScrambleResult {
  key: number;
  caseId: string;
  name: string;
  solution: string;
  seconds: number;
  recognitionMs: number | null;
  moveCount: number | null;
  tps: number | null;
  /** Taken back with undo: no longer recorded. */
  undone: boolean;
}

export interface NoScrambleSnapshot {
  view: NoScrambleView | null;
  results: readonly NoScrambleResult[];
  /** Waiting for the cube to rest before the next case; `key` changes when the wait restarts. */
  settle: { key: number } | null;
}

const EMPTY: NoScrambleSnapshot = { view: null, results: [], settle: null };

class VirtualHolder {
  session: VirtualSession | null = null;
  private snapshot: NoScrambleSnapshot = EMPTY;
  private resets = 0;
  private resultKeys = 0;
  private settleKeys = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private undos = new Map<number, () => void>();
  /** Recent turns, for the reset gesture. */
  recent: { face: Face; amount: 1 | 3; at: number }[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;
  get view() { return this.snapshot.view; }
  get settling() { return this.snapshot.settle !== null; }

  private publish(patch: Partial<NoScrambleSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  set(session: VirtualSession | null, jumped: boolean) {
    if (session === this.session) return;
    if (jumped) {
      this.resets++;
      this.recent = [];
    }
    this.session = session;
    this.publish({
      view: session && {
        practice: session.practice,
        holding: session.holding,
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
      },
    });
  }

  addResult(result: Omit<NoScrambleResult, 'key' | 'undone'>, undo: (() => void) | null) {
    const key = ++this.resultKeys;
    if (undo) this.undos.set(key, undo);
    this.publish({ results: [{ ...result, key, undone: false }, ...this.snapshot.results] });
  }

  undo(key: number) {
    const undo = this.undos.get(key);
    if (!undo) return;
    this.undos.delete(key);
    undo();
    this.publish({ results: this.snapshot.results.map((r) => (r.key === key ? { ...r, undone: true } : r)) });
  }

  /** (Re)start the wait for the cube to rest; `done` runs once it has. */
  startSettle(done: () => void) {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.publish({ settle: null });
      done();
    }, SETTLE_MS);
    this.publish({ settle: { key: ++this.settleKeys } });
  }

  clearSettle() {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = null;
    if (this.snapshot.settle) this.publish({ settle: null });
  }
}

const serverSnapshot = () => EMPTY;

/**
 * No-scramble mode: the case is shown on a virtual cube built from the
 * trainer's setup, the smart cube's turns move it, the first turn starts the
 * timer and reaching the practice's goal stops it. The practice runs from the
 * cube alone: a solve is recorded as soon as it stops (undo takes it back),
 * and the next case comes once the cube has been still for SETTLE_MS.
 * Turning one face the same way four times in a row starts the case again.
 */
export function useNoScrambleTrainer({
  active, practice, scramble, trainerState, describe, record, onStart, onStop, onAbort, onAdvance,
}: {
  active: boolean;
  practice: TrainerPractice;
  /** The case's setup in the user's notation, as the trainer built it. */
  scramble: string | null;
  trainerState: TrainerState;
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
}): NoScrambleSnapshot & {
  connected: boolean;
  reset: () => void;
  stopByHand: () => void;
  next: () => void;
  undo: (key: number) => void;
} {
  const cube = useSmartCube();
  const { holding } = useSmartCubeSettings();
  const connected = cube.status === 'connected';
  const [holder] = useState(() => new VirtualHolder());
  const snapshot = useSyncExternalStore(holder.subscribe, holder.getSnapshot, serverSnapshot);
  const callbacks = useRef({ describe, record, onStart, onStop, onAbort, onAdvance });
  useEffect(() => { callbacks.current = { describe, record, onStart, onStop, onAbort, onAdvance }; });
  // The phone is put down while practising, so keep its screen on.
  useKeepAwake(active && connected);

  // A new case (or holding) shows a fresh virtual cube; the trainer's own
  // start and stop (tap, Space) are mirrored into the attempt.
  useEffect(() => {
    if (!active || !scramble) {
      holder.clearSettle();
      holder.set(null, true);
    } else if (trainerState === 'idle') {
      holder.clearSettle();
      holder.set(startVirtual(practice, holding, scramble, performance.now()), true);
    } else if (holder.session) {
      holder.set(trainerState === 'running' ? manualStartVirtual(holder.session) : manualStopVirtual(holder.session), false);
    }
  }, [holder, active, practice, holding, scramble, trainerState]);

  useEffect(() => () => holder.clearSettle(), [holder]);

  // The attempt just stopped: record it and wait for the cube to rest.
  const finish = (cubeSeconds: number | null) => {
    const session = holder.session;
    if (!session) return;
    const seconds = callbacks.current.onStop(cubeSeconds);
    const info = callbacks.current.describe();
    const solve = holder.view?.solve ?? null;
    if (info && seconds > 0) {
      const undo = callbacks.current.record(info.caseId, seconds, solve);
      const moveCount = solve ? mergeTurns(solve.turns).length : null;
      holder.addResult({
        ...info,
        seconds,
        recognitionMs: session.recognitionMs,
        moveCount,
        tps: solve && moveCount !== null ? turnsPerSecond(moveCount, solve.executionMs) : null,
      }, undo);
    }
    holder.startSettle(() => callbacks.current.onAdvance());
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
      // Turns after the stop (a last AUF, setting the cube down) only delay the next case.
      if (session.phase === 'done') {
        if (holder.settling) holder.startSettle(() => callbacks.current.onAdvance());
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
  }, [holder, active, connected]);

  const stopByHand = () => {
    const session = holder.session;
    if (!session || session.phase !== 'running') return;
    holder.set(manualStopVirtual(session), false);
    finish(null);
  };

  const next = () => {
    if (!holder.settling) return;
    holder.clearSettle();
    callbacks.current.onAdvance();
  };

  return {
    view: active ? snapshot.view : null,
    results: snapshot.results,
    settle: active ? snapshot.settle : null,
    connected,
    reset,
    stopByHand,
    next,
    undo: (key) => holder.undo(key),
  };
}
