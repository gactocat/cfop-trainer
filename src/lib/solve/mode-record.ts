// Records of the parts of CFOP solved on their own (solve-modes.ts): the
// same SolveRecord as a CFOP solve, with the mode as its `event`, so each
// mode's solves are listed, counted and synced on their own.
//
// A cube solve keeps where each CFOP stage ended (`split`), as CFOP's do;
// the stages before the mode's first were done before the first turn
// (-1), and the reading stops at the mode's last stage:
//
//   cross  ends [cross]                    the cross of the colour made
//   f2l    ends [-1, f2l1, ..., f2l4]      the cross the scramble left
//   ll     ends [-1 x 5, oll, pll]         the cross the scramble left
//
// `crossColour` is that colour and `holding` the scramble orientation turned
// over to put it at the bottom, as for CFOP. The functions here take every
// kind's records: CFOP's are made and read by solve-record.ts (cubeSolve,
// readRecord, which reads every CFOP record again from its turns), the
// others as stored.

import type { CubeState, Face } from '@/lib/smart-cube/cube-state';
import {
  colourFace, colourFrame, FACE_COLOUR, frameColours, holdingFrame, turnedDown,
  type ColourHolding, type CubeColour, type Frame,
} from '@/lib/smart-cube/holding';
import { cfopLevel, cfopMoveCount, cfopStages, CFOP_STAGES, type CfopSplit, type StageResult, type TimedTurn } from '@/lib/solve/cfop-split';
import { solvedCrosses } from '@/lib/solve/solve-goal';
import { DEFAULT_MODE_CROSS, SOLVE_MODE, type SolveMode } from '@/lib/solve/solve-modes';
import {
  cubeSolve, handSolve, readRecord, recordFrame, recordMoveCount,
  type Penalty, type RecordReading, type SolveRecord,
} from '@/lib/solve/solve-record';

/** Where the mode's last stage sits in CFOP_STAGES. */
const lastStage = (mode: SolveMode) => CFOP_STAGES.indexOf(SOLVE_MODE[mode].stages[SOLVE_MODE[mode].stages.length - 1]);

/**
 * Where each stage ended, read with the cross on cube face `cross`: for each
 * CFOP stage up to the mode's last, the turn after which the cube was first
 * at least that far (-1: before the first turn). `states` are the states
 * after each turn, `start` the state before the first.
 */
export function splitMode(mode: SolveMode, start: CubeState, states: readonly CubeState[], cross: Face): CfopSplit {
  const levels = lastStage(mode) + 1;
  const ends: number[] = [];
  [start, ...states].forEach((state, i) => {
    const level = Math.min(cfopLevel(state, cross), levels);
    while (ends.length < level) ends.push(i - 1);
  });
  return { cross, ends };
}

/**
 * The colour of the cross a cross solve made: the cross solved at its end,
 * the bottom of the scramble orientation first when two were made at once.
 */
function crossMade(end: CubeState, scrambleFrame: Frame): CubeColour {
  return FACE_COLOUR[solvedCrosses(end, scrambleFrame.D)[0] ?? scrambleFrame.D];
}

/** A mode's solve timed by hand: the time only. */
export function modeHandSolve(
  mode: SolveMode,
  scramble: string,
  ms: number,
  extra: { penalty?: Penalty; inspectionMs?: number } = {},
  now = new Date(),
): SolveRecord {
  return { ...handSolve(scramble, ms, extra, now), event: SOLVE_MODE[mode].event };
}

/**
 * A mode's solve timed by a smart cube, from its first turn to the one that
 * reached the goal (for CFOP, solve-record.ts's cubeSolve).
 */
export function modeCubeSolve(mode: SolveMode, input: {
  scramble: string;
  /** How the cube was held for the scramble. */
  scrambleHolding: ColourHolding;
  /** f2l and ll: the colour the scramble left the cross in (white unless chosen). The cross alone reads it from the solve. */
  cross?: CubeColour;
  /** The scrambled state the solve started from. */
  start: CubeState;
  /** Turns with absolute cube times, and the state after each. */
  turns: readonly { face: Face; amount: 1 | 3; cubeTime: number; state: CubeState }[];
  penalty?: Penalty;
  inspectionMs?: number;
  now?: Date;
}): SolveRecord {
  if (mode === 'cfop') return cubeSolve(input);
  const first = input.turns[0]?.cubeTime ?? 0;
  const turns: TimedTurn[] = input.turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - first }));
  const states = input.turns.map((t) => t.state);
  const scrambleHolding = { top: input.scrambleHolding.top, front: input.scrambleHolding.front };
  const scrambleFrame = colourFrame(scrambleHolding) ?? holdingFrame('white-green');
  const cross = mode === 'cross' ? crossMade(states[states.length - 1] ?? input.start, scrambleFrame) : input.cross ?? DEFAULT_MODE_CROSS;
  const split = splitMode(mode, input.start, states, colourFace(cross));
  const record = modeHandSolve(mode, input.scramble, turns.length ? turns[turns.length - 1].t : 0, input, input.now);
  return {
    ...record,
    timer: 'cube',
    holding: frameColours(turnedDown(scrambleFrame, cross).frame),
    scrambleHolding,
    crossColour: cross,
    turns,
    moveCount: cfopMoveCount(turns, split),
    split,
  };
}

type ReadableRecord = Pick<SolveRecord, 'event' | 'scramble' | 'holding' | 'scrambleHolding' | 'turns' | 'split'>;

/**
 * Where a cube solve ended each stage and the frame its turns are read in;
 * null for a solve timed by hand. CFOP's records as readRecord reads them,
 * the other kinds' as stored.
 */
export function readModeRecord(record: ReadableRecord): RecordReading | null {
  if (record.event === 'cfop') return readRecord(record);
  if (!record.turns || !record.split) return null;
  return { split: record.split, frame: recordFrame(record) };
}

/**
 * The mode's stages of a solve, as cfop-split.ts reads them: each with its
 * time, recognition and execution, moves, TPS (of execution) and moves as
 * made. The stages before the mode's first, done before the first turn,
 * are left out.
 */
export function modeStages(mode: SolveMode, turns: readonly TimedTurn[], reading: RecordReading): StageResult[] {
  const stages = SOLVE_MODE[mode].stages;
  return cfopStages(turns, reading.split, reading.frame).filter((stage) => stages.includes(stage.stage));
}

/** The stages of a recorded cube solve of any kind (its event); null for a solve timed by hand. */
export function modeRecordStages(record: ReadableRecord): StageResult[] | null {
  const reading = readModeRecord(record);
  if (!reading || !record.turns) return null;
  return modeStages(record.event, record.turns, reading);
}

/** Moves of a recorded solve of any kind as the screens count them (slices once); undefined for a solve timed by hand. */
export function modeMoveCount(record: ReadableRecord & Pick<SolveRecord, 'moveCount'>): number | undefined {
  if (record.event === 'cfop') return recordMoveCount(record);
  return record.turns && record.split ? cfopMoveCount(record.turns, record.split) : record.moveCount;
}
