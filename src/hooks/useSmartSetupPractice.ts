'use client';

import { useEffect, useRef } from 'react';
import { useKeepAwake } from '@/hooks/useNativeTimer';
import { useSmartCube } from '@/hooks/useSmartCube';
import { useSmartCubeTrainer, type SmartSolve, type SmartTrainerView } from '@/hooks/useSmartCubeTrainer';
import type { PracticeCase, PracticeLog } from '@/lib/practice-log';
import { timedMoveCount, turnsPerSecond } from '@/lib/smart-cube/solve-record';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

type TrainerState = 'idle' | 'running' | 'stopped';

/**
 * With setup on a connected smart cube, run like no-scramble practice: the
 * setup is guided turn by turn, the first turn after it starts the timer and
 * the goal stops it, and the solve is recorded in `log` at once (undo takes
 * it back). The next case comes with `next`. Same contract as
 * useNoScrambleTrainer.
 */
export function useSmartSetupPractice({
  active, practice, scramble, trainerState, recognition, log, describe, record, onStart, onStop, onAdvance,
}: {
  active: boolean;
  /** Keep the recognition (setup done to first turn) with each solve; otherwise none is kept. */
  recognition: boolean;
  practice: TrainerPractice;
  /** The case's setup in the user's notation, as the trainer built it. */
  scramble: string | null;
  trainerState: TrainerState;
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
  const callbacks = useRef({ recognition, describe, record, onStop, onAdvance });
  useEffect(() => { callbacks.current = { recognition, describe, record, onStop, onAdvance }; });
  useKeepAwake(active && connected);

  const finish = (cubeSeconds: number | null, timed: SmartSolve | null) => {
    const seconds = callbacks.current.onStop(cubeSeconds);
    const info = callbacks.current.describe();
    // Recognition not measured is kept nowhere, the cube's record included.
    const solve = timed && !callbacks.current.recognition ? { ...timed, recognitionMs: null } : timed;
    if (info && seconds > 0) {
      const undo = callbacks.current.record(info.caseId, seconds, solve);
      const moveCount = solve ? timedMoveCount(solve) : null;
      log.add({
        ...info,
        seconds,
        recognitionMs: solve?.recognitionMs ?? null,
        moveCount,
        tps: solve && moveCount !== null ? turnsPerSecond(moveCount, solve.executionMs) : null,
      }, undo);
    }
  };

  const view = useSmartCubeTrainer({
    practice,
    scramble: active ? scramble : null,
    trainerState,
    onStart,
    onStop: finish,
  });

  return {
    view: active ? view : null,
    connected,
    stopByHand: () => { if (trainerState === 'running') finish(null, null); },
    next: () => {
      if (trainerState !== 'stopped') return;
      callbacks.current.onAdvance();
    },
  };
}
