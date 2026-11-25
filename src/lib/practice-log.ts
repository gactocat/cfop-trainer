// The solves of one practice session, newest first, with the way to take
// each back, and (with a smart cube) the wait for the cube to rest before the
// next case. Kept in memory only: the trainer creates one per session
// (usePracticeLog), so closing the practice or starting it again begins empty.

/** With auto-advance, the next case comes once the cube has been still this long after a solve. */
export const SETTLE_MS = 1500;

/** What the trainer knows about the case on screen, read when it is solved. */
export interface PracticeCase {
  caseId: string;
  name: string;
  solution: string;
}

/** One solve of this session, newest first in `results`. */
export interface PracticeResult extends PracticeCase {
  key: number;
  seconds: number;
  recognitionMs: number | null;
  moveCount: number | null;
  tps: number | null;
  /** Taken back with undo: no longer recorded. */
  undone: boolean;
  /** Epoch ms it was recorded. */
  at: number;
}

export interface PracticeLogSnapshot {
  results: readonly PracticeResult[];
  /** Waiting for the cube to rest before the next case; `key` changes when the wait restarts. */
  settle: { key: number } | null;
}

export class PracticeLog {
  private snapshot: PracticeLogSnapshot = { results: [], settle: null };
  private resultKeys = 0;
  private settleKeys = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private undos = new Map<number, () => void>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;
  get settling() { return this.snapshot.settle !== null; }

  private publish(patch: Partial<PracticeLogSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  /**
   * Add a solve; `undo` also takes back what was saved elsewhere (a case
   * practice's time, a smart cube record), null when nothing was.
   */
  add(result: Omit<PracticeResult, 'key' | 'undone' | 'at'>, undo: (() => void) | null) {
    const key = ++this.resultKeys;
    this.undos.set(key, undo ?? (() => {}));
    this.publish({ results: [{ ...result, key, undone: false, at: Date.now() }, ...this.snapshot.results] });
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

/**
 * Case practice saves each solve to the practised algorithm's times (random
 * practice keeps its solves in the session only): how to add and take back
 * a time, and the algorithm's figures for the result screen.
 */
export interface CaseTimes {
  /** Returns the time's id, or null when nothing was saved. */
  add: (seconds: number) => string | null;
  remove: (timeId: string) => void;
  best: number | null;
  ao5: number | null;
  count: number;
}

/**
 * What a cube-timed solve saves outside the session, and how to take it back.
 * Case practice saves the time to the algorithm and the cube's record of the
 * solve (shown on the case page); random practice keeps its solves in the
 * session only, so it saves neither. Null when nothing was saved.
 */
export function saveCubeSolve<Solve>({ caseTimes, seconds, solve, saveSmart, deleteSmart }: {
  caseTimes: CaseTimes | undefined;
  seconds: number;
  /** The cube's record of the attempt; null when it was stopped by hand. */
  solve: Solve | null;
  saveSmart: (solve: Solve) => string;
  deleteSmart: (id: string) => void;
}): (() => void) | null {
  if (!caseTimes) return null;
  const timeId = caseTimes.add(seconds);
  const smartId = solve ? saveSmart(solve) : null;
  if (!timeId && !smartId) return null;
  return () => {
    if (timeId) caseTimes.remove(timeId);
    if (smartId) deleteSmart(smartId);
  };
}
