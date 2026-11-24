'use client';

import { useEffect, useRef } from 'react';
import { useKeepAwake } from '@/hooks/useNativeTimer';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useSmartCubeTrainer, type SmartSolve, type SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import type { PracticeCase, PracticeLog } from '@/lib/practice-log';
import { mergeTurns, turnsPerSecond } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

type TrainerState = 'idle' | 'running' | 'stopped';

/**
 * With setup on a connected smart cube, run like no-scramble practice: the
 * setup is guided turn by turn, the first turn after it starts the timer and
 * the goal stops it, and the solve is recorded in `log` at once (undo takes
 * it back). The next case comes with `next`, or, with `autoAdvance`, once the
 * cube has rested. Same contract as useNoScrambleTrainer.
 */
export function useSmartSetupPractice({
  active, practice, scramble, trainerState, autoAdvance, log, describe, record, onStart, onStop, onAdvance,
}: {
  active: boolean;
  practice: TrainerPractice;
  /** The case's setup in the user's notation, as the trainer built it. */
  scramble: string | null;
  trainerState: TrainerState;
  autoAdvance: boolean;
  log: PracticeLog;
  describe: () => PracticeCase | null;
  /** Record a solve; returns how to take it back, or null when nothing was recorded. */
  record: (caseId: string, seconds: number, solve: SmartSolve | null) => (() => void) | null;
  onStart: () => void;
  /** Stop the trainer: seconds on the cube clock, or null to time it itself. Returns the seconds it settled on. */
  onStop: (seconds: number | null) => number;
  onAdvance: () => void;
}): {
  view: SmartTrainerView | null;
  connected: boolean;
  stopByHand: () => void;
  next: () => void;
} {
  const connected = useSmartCube().status === 'connected';
  const callbacks = useRef({ autoAdvance, describe, record, onStop, onAdvance });
  useEffect(() => { callbacks.current = { autoAdvance, describe, record, onStop, onAdvance }; });
  useKeepAwake(active && connected);

  const finish = (cubeSeconds: number | null, solve: SmartSolve | null) => {
    const seconds = callbacks.current.onStop(cubeSeconds);
    const info = callbacks.current.describe();
    if (info && seconds > 0) {
      const undo = callbacks.current.record(info.caseId, seconds, solve);
      const moveCount = solve ? mergeTurns(solve.turns).length : null;
      log.add({
        ...info,
        seconds,
        recognitionMs: solve?.recognitionMs ?? null,
        moveCount,
        tps: solve && moveCount !== null ? turnsPerSecond(moveCount, solve.executionMs) : null,
      }, undo);
    }
    if (callbacks.current.autoAdvance) log.startSettle(() => callbacks.current.onAdvance());
  };

  const view = useSmartCubeTrainer({
    practice,
    scramble: active ? scramble : null,
    trainerState,
    onStart,
    onStop: finish,
    // Turns after the stop (a last AUF, setting the cube down) only delay an automatic next case.
    onTurnAfterStop: () => { if (log.settling) log.startSettle(() => callbacks.current.onAdvance()); },
  });

  // A new case starts without a pending automatic next case. (The log is
  // shared with no-scramble practice, so only while this one is on.)
  useEffect(() => {
    if (active && trainerState === 'idle') log.clearSettle();
  }, [log, active, trainerState, scramble]);

  return {
    view: active ? view : null,
    connected,
    stopByHand: () => { if (trainerState === 'running') finish(null, null); },
    next: () => {
      if (trainerState !== 'stopped') return;
      log.clearSettle();
      callbacks.current.onAdvance();
    },
  };
}
