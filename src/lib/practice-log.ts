// The solves of one practice session driven by a smart cube (no setup on the
// virtual cube, or with setup on the cube itself), newest first, with the way
// to take each back, and the wait for the cube to rest before the next case.
// Plain store: the trainer creates one per session (usePracticeLog).

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

  /** Add a recorded solve; `undo` takes the record back, null when nothing was recorded. */
  add(result: Omit<PracticeResult, 'key' | 'undone'>, undo: (() => void) | null) {
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
