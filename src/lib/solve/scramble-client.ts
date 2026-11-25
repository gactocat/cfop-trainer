// The page's side of the scramble worker: random-state scrambles, one kept
// ready ahead, and routes between cube states for the smart cube guide.
// Where a worker cannot start, the same code runs on the main thread after a
// paint, so the page still works (it may pause while the tables are built).

import type { CubeState } from '@/lib/smart-cube/cube-state';
import type { SolverMove } from '@/lib/solver/two-phase';
import type { ScrambleRequest, ScrambleResponse } from '@/lib/solve/scramble-worker';

type Body = ScrambleRequest extends infer R ? (R extends ScrambleRequest ? Omit<R, 'id'> : never) : never;

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { body: Body; resolve: (value: unknown) => void; reject: (error: Error) => void }>();

/** Run a request on this thread: the fallback when no worker can run. */
async function runHere(body: Body): Promise<unknown> {
  // Let the page paint its "making a scramble" state first.
  await new Promise((resolve) => setTimeout(resolve, 30));
  const { generateScramble, routeBetween } = await import('@/lib/solve/scramble');
  const { initTwoPhase } = await import('@/lib/solver/two-phase');
  if (body.type === 'init') {
    initTwoPhase();
    return true;
  }
  if (body.type === 'scramble') return generateScramble();
  return routeBetween(body.from, body.to, body.timeLimitMs);
}

function failOver() {
  worker?.terminate();
  worker = null;
  const waiting = [...pending.values()];
  pending.clear();
  for (const { body, resolve, reject } of waiting) runHere(body).then(resolve, reject);
}

function startWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./scramble-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
    return null;
  }
  worker.addEventListener('message', (event: MessageEvent<ScrambleResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (event.data.error !== undefined) entry.reject(new Error(event.data.error));
    else entry.resolve(event.data.result);
  });
  // The worker script failed to load or crashed: finish its requests here.
  worker.addEventListener('error', failOver);
  return worker;
}

function call(body: Body): Promise<unknown> {
  const target = typeof Worker === 'undefined' ? null : startWorker();
  if (!target) return runHere(body);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { body, resolve, reject });
    target.postMessage({ ...body, id });
  });
}

// --- The scramble on screen, with the next one made ahead

export interface ScrambleSnapshot {
  /** Null while the next scramble is being made. */
  scramble: string | null;
  failed: boolean;
}

const EMPTY: ScrambleSnapshot = { scramble: null, failed: false };
let snapshot = EMPTY;
const listeners = new Set<() => void>();
let ready: string | null = null;
let making = false;
let waitingSince: number | null = null;

function show(next: ScrambleSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function deliver(scramble: string) {
  if (waitingSince !== null) {
    // How long the screen waited, readable in the browser's performance timeline.
    performance.measure?.('cfop:scramble-wait', { start: waitingSince, end: performance.now() });
    waitingSince = null;
  }
  show({ scramble, failed: false });
}

function makeAhead() {
  if (ready !== null || making) return;
  making = true;
  call({ type: 'scramble' }).then((value) => {
    making = false;
    if (waitingSince !== null) {
      deliver(value as string);
      makeAhead();
    } else {
      ready = value as string;
    }
  }, () => {
    making = false;
    if (waitingSince !== null) show({ scramble: null, failed: true });
  });
}

export const getScrambleSnapshot = () => snapshot;
export const getScrambleServerSnapshot = () => EMPTY;

/** Subscribing starts the first scramble. */
export function subscribeScramble(listener: () => void) {
  listeners.add(listener);
  if (snapshot.scramble === null && waitingSince === null) nextScramble();
  return () => { listeners.delete(listener); };
}

/** Show the next scramble: at once when it is ready, otherwise once made. */
export function nextScramble(): void {
  if (ready !== null) {
    const scramble = ready;
    ready = null;
    show({ scramble, failed: false });
  } else {
    waitingSince = performance.now();
    show(EMPTY);
  }
  makeAhead();
}

/** Cube-frame turns from one state to another, or null when there is no way (an illegal state). */
export function findRoute(from: CubeState, to: CubeState, timeLimitMs = 200): Promise<SolverMove[] | null> {
  return call({ type: 'route', from, to, timeLimitMs }) as Promise<SolverMove[] | null>;
}
