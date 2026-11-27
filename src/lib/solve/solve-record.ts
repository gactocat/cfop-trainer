// One timed solve from a scramble, as kept on the device or in the account
// (solve-store.ts). A solve timed by hand has its time only; one timed by a
// smart cube also keeps its turns and where each CFOP stage ended.

import { applyTurn, SOLVED, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import {
  colourFace,
  colourFrame,
  frameColours,
  holdingFrame,
  turnedDown,
  type ColourHolding,
  type CubeColour,
  type CubeHolding,
  type Frame,
} from '@/lib/smart-cube/holding';
import { cfopMoveCount, splitCfop, type CfopSplit, type TimedTurn } from '@/lib/solve/cfop-split';
import { applyPlan, planSetup } from '@/lib/smart-cube/setup-guide';

/** The kind of solve. Only CFOP exists; F2L and last-layer solves are planned. */
export type SolveEvent = 'cfop';
export const SOLVE_EVENTS: readonly SolveEvent[] = ['cfop'];

/** +2 seconds, or did not finish. */
export type Penalty = 'plus2' | 'dnf';

export interface SolveRecord {
  id: string;
  version: 1;
  event: SolveEvent;
  /** ISO time the solve was recorded. */
  recordedAt: string;
  /** The scramble shown, in standard notation. */
  scramble: string;
  /** The time as measured: on the cube's clock (first to last turn) or the screen's (start to stop). */
  ms: number;
  timer: 'hand' | 'cube';
  /** Set by the inspection or by hand; absent when none. */
  penalty?: Penalty;
  /** Inspection to the start, when there was one. */
  inspectionMs?: number;
  /**
   * How the cube was held while solving, the frame its turns are read in:
   * the scramble's holding turned over to put the cross colour at the
   * bottom. In older records the one holding used for both the scramble and
   * the solve; in records from the first version, a smart cube holding.
   * Cube solves only, as are the fields below.
   */
  holding?: ColourHolding | CubeHolding;
  /** How the cube was held for the scramble; absent in older records, where `holding` was. */
  scrambleHolding?: ColourHolding;
  /**
   * The cross colour `split` was read with. Absent in older records, whose
   * stored stages took the cross on the bottom of `holding`: they are read
   * again from their turns with the colour set now (`readRecord`).
   */
  crossColour?: CubeColour;
  /** Every turn from the first to the one that solved the cube. */
  turns?: TimedTurn[];
  moveCount?: number;
  split?: CfopSplit;
}

/** A random (v4) UUID: the account keeps solves by it. */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The frame a record's turns are written in (yellow top, blue front when unknown). */
export function recordFrame(record: Pick<SolveRecord, 'holding'>): Frame {
  const holding = record.holding;
  if (typeof holding === 'string') return holdingFrame(holding);
  return (holding && colourFrame(holding)) ?? holdingFrame('yellow-blue');
}

export function handSolve(scramble: string, ms: number, extra: Pick<SolveRecord, 'penalty' | 'inspectionMs'> = {}, now = new Date()): SolveRecord {
  return {
    id: newId(), version: 1, event: 'cfop', recordedAt: now.toISOString(), scramble, ms: Math.round(ms), timer: 'hand',
    ...withExtra(extra),
  };
}

const withExtra = ({ penalty, inspectionMs }: Pick<SolveRecord, 'penalty' | 'inspectionMs'>) => ({
  ...(penalty ? { penalty } : {}),
  ...(inspectionMs !== undefined ? { inspectionMs: Math.round(inspectionMs) } : {}),
});

export function cubeSolve(input: {
  scramble: string;
  /** How the cube was held for the scramble. */
  scrambleHolding: ColourHolding;
  /** The colour of the cross, solved at the bottom. */
  cross: CubeColour;
  /** The scrambled state the solve started from. */
  start: CubeState;
  /** Turns with absolute cube times, and the state after each. */
  turns: readonly { face: Face; amount: 1 | 3; cubeTime: number; state: CubeState }[];
  penalty?: Penalty;
  inspectionMs?: number;
  now?: Date;
}): SolveRecord {
  const first = input.turns[0]?.cubeTime ?? 0;
  const turns: TimedTurn[] = input.turns.map((t) => ({ face: t.face, amount: t.amount, t: t.cubeTime - first }));
  const split = splitCfop(input.start, input.turns.map((t) => t.state), colourFace(input.cross));
  const scrambleHolding = { top: input.scrambleHolding.top, front: input.scrambleHolding.front };
  const solving = turnedDown(colourFrame(scrambleHolding) ?? holdingFrame('white-green'), input.cross).frame;
  return {
    id: newId(),
    version: 1,
    event: 'cfop',
    recordedAt: (input.now ?? new Date()).toISOString(),
    scramble: input.scramble,
    ms: turns.length ? turns[turns.length - 1].t : 0,
    timer: 'cube',
    ...withExtra(input),
    holding: frameColours(solving),
    scrambleHolding,
    crossColour: input.cross,
    turns,
    moveCount: cfopMoveCount(turns, split),
    split,
  };
}

/** A cube solve as the screens read it: where its stages ended and how the cube was held to solve. */
export interface RecordReading {
  split: CfopSplit;
  /** The frame its turns are read in. */
  frame: Frame;
}

type ReadableRecord = Pick<SolveRecord, 'scramble' | 'holding' | 'crossColour' | 'turns' | 'split'>;

const sameEnds = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((end, i) => end === b[i]);

function readAgain(record: ReadableRecord & Required<Pick<SolveRecord, 'turns' | 'split'>>, cross: CubeColour): RecordReading {
  const scrambleFrame = recordFrame(record);
  const stored = { split: record.split, frame: scrambleFrame };
  // The scrambled state, as solve-session.ts sets it (scramble.ts's
  // scrambleState, without the solver this module would pull in).
  const plan = planSetup(record.scramble, scrambleFrame);
  if (!plan) return stored;
  const start = applyPlan(SOLVED, plan);
  const states: CubeState[] = [];
  record.turns.reduce((state, turn) => {
    const next = applyTurn(state, turn.face, turn.amount);
    states.push(next);
    return next;
  }, start);
  // The replay stands only if it gives back the stages stored (the cube
  // did not resync to another state mid-solve).
  if (!sameEnds(splitCfop(start, states, record.split.cross).ends, record.split.ends)) return stored;
  return { split: splitCfop(start, states, colourFace(cross)), frame: turnedDown(scrambleFrame, cross).frame };
}

const readings = new WeakMap<object, Partial<Record<CubeColour, RecordReading | null>>>();

/**
 * Where a cube solve's stages ended and how the cube was held to solve;
 * null for a solve timed by hand. A record that keeps its cross colour reads
 * as stored. An older one is read again from its turns with `cross` (the
 * colour set now): replayed from its scrambled state with the cross on that
 * colour, its moves read with the cube turned over to put it at the bottom
 * (white top, green front with a white cross: x2).
 */
export function readRecord(record: ReadableRecord, cross: CubeColour): RecordReading | null {
  const { turns, split } = record;
  if (!turns || !split) return null;
  if (record.crossColour) return { split, frame: recordFrame(record) };
  const cached = readings.get(record) ?? {};
  if (!(cross in cached)) {
    cached[cross] = readAgain({ ...record, turns, split }, cross);
    readings.set(record, cached);
  }
  return cached[cross]!;
}

/**
 * The moves of a cube solve as the screens count them, read again from its
 * turns (records made before slices were read count a slice as two) with
 * its stages as `readRecord` reads them; undefined for a solve timed by hand.
 */
export function recordMoveCount(record: ReadableRecord & Pick<SolveRecord, 'moveCount'>, cross: CubeColour): number | undefined {
  const reading = readRecord(record, cross);
  return reading && record.turns ? cfopMoveCount(record.turns, reading.split) : record.moveCount;
}

/** A record with a penalty set or taken off. */
export function withPenalty(record: SolveRecord, penalty: Penalty | null): SolveRecord {
  const next = { ...record };
  delete next.penalty;
  return penalty ? { ...next, penalty } : next;
}

/**
 * A record read back from storage or the account, or null when it is not one
 * this version can show. Unknown fields are kept, so a newer version's
 * additions survive being saved again here.
 */
export function parseSolveRecord(raw: unknown): SolveRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.version !== 1 || !SOLVE_EVENTS.includes(r.event as SolveEvent)) return null;
  if (typeof r.recordedAt !== 'string' || Number.isNaN(Date.parse(r.recordedAt))) return null;
  if (typeof r.scramble !== 'string' || typeof r.ms !== 'number' || !Number.isFinite(r.ms) || r.ms < 0) return null;
  if (r.timer !== 'hand' && r.timer !== 'cube') return null;
  const record = { ...r } as unknown as SolveRecord;
  if (r.penalty !== undefined && r.penalty !== 'plus2' && r.penalty !== 'dnf') delete record.penalty;
  if (r.inspectionMs !== undefined && (typeof r.inspectionMs !== 'number' || !Number.isFinite(r.inspectionMs))) delete record.inspectionMs;
  return record;
}
