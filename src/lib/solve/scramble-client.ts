// The page's side of the scramble worker: random-state scrambles, one kept
// ready ahead for each kind of solve, and routes between cube states for the
// smart cube guide. Where a worker cannot start, the same code runs on the
// main thread after a paint, so the page still works (it may pause while the
// tables are built).

import type { CubeState, Face } from '@/lib/smart-cube/cube-state';
import type { SolveMode } from '@/lib/solve/solve-modes';
import { scrambleFitsMode } from '@/lib/solve/solve-goal';
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
  const { routeBetween } = await import('@/lib/solve/scramble');
  const { generateModeScramble } = await import('@/lib/solve/mode-scramble');
  const { initTwoPhase } = await import('@/lib/solver/two-phase');
  if (body.type === 'init') {
    initTwoPhase();
    return true;
  }
  if (body.type === 'scramble') return generateModeScramble(body.mode ?? 'cfop', body.face);
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

// --- The scramble on screen, with the next one made ahead (one feed per kind)

export interface ScrambleSnapshot {
  /** Null while the next scramble is being made. */
  scramble: string | null;
  failed: boolean;
}

/**
 * The scrambles of one kind of solve. `face` (f2l and ll) is where the
 * scramble leaves the cross, as it is written: mode-scramble.ts's
 * scrambleCrossFace for the scramble orientation and cross colour (U for a
 * white cross from white top, green front, the default).
 */
export interface ScrambleSpec {
  mode: SolveMode;
  face?: Face;
}

export interface ScrambleFeed {
  getSnapshot(): ScrambleSnapshot;
  getServerSnapshot(): ScrambleSnapshot;
  /** Subscribing starts the first scramble. */
  subscribe(listener: () => void): () => void;
  /** Show the next scramble: at once when it is ready, otherwise once made. */
  next(): void;
}

const EMPTY: ScrambleSnapshot = { scramble: null, failed: false };

/** One feed per mode and, for the modes that leave a cross, per face. */
const specKey = ({ mode, face = 'U' }: ScrambleSpec) => (mode === 'f2l' || mode === 'll' ? `${mode}:${face}` : mode);

function createFeed(spec: ScrambleSpec, key: string): ScrambleFeed {
  const body: Body = { type: 'scramble', mode: spec.mode, face: spec.face };
  let snapshot = EMPTY;
  const listeners = new Set<() => void>();
  let ready: string | null = null;
  let making = false;
  let waitingSince: number | null = null;

  const show = (next: ScrambleSnapshot) => {
    snapshot = next;
    listeners.forEach((l) => l());
  };

  const deliver = (scramble: string) => {
    if (waitingSince !== null) {
      // How long the screen waited, readable in the browser's performance timeline.
      performance.measure?.(key === 'cfop' ? 'cfop:scramble-wait' : `cfop:scramble-wait:${key}`, { start: waitingSince, end: performance.now() });
      waitingSince = null;
    }
    show({ scramble, failed: false });
  };

  // A scramble that does not fit its mode comes from a worker of an earlier
  // deploy (a service worker cache can hand one out): stop using the worker
  // and make the scramble here instead.
  const fits = (value: unknown) => typeof value === 'string' && scrambleFitsMode(spec.mode, value, spec.face);
  const makeAhead = () => {
    if (ready !== null || making) return;
    making = true;
    call(body).then((value) => {
      if (fits(value)) return value;
      failOver();
      return runHere(body);
    }).then((value) => {
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
  };

  const next = () => {
    if (ready !== null) {
      const scramble = ready;
      ready = null;
      show({ scramble, failed: false });
    } else {
      waitingSince = performance.now();
      show(EMPTY);
    }
    makeAhead();
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,
    subscribe(listener) {
      listeners.add(listener);
      if (snapshot.scramble === null && waitingSince === null) next();
      return () => { listeners.delete(listener); };
    },
    next,
  };
}

const feeds = new Map<string, ScrambleFeed>();

/** The scrambles of one kind of solve; the same feed for the same kind, so it can be read with useSyncExternalStore. */
export function scrambleFeed(spec: ScrambleSpec): ScrambleFeed {
  const key = specKey(spec);
  let feed = feeds.get(key);
  if (!feed) {
    feed = createFeed(spec, key);
    feeds.set(key, feed);
  }
  return feed;
}

// CFOP's scrambles, as before modes.
const cfopFeed = scrambleFeed({ mode: 'cfop' });
export const getScrambleSnapshot = cfopFeed.getSnapshot;
export const getScrambleServerSnapshot = cfopFeed.getServerSnapshot;
export const subscribeScramble = cfopFeed.subscribe;
export const nextScramble = cfopFeed.next;

/** Cube-frame turns from one state to another, or null when there is no way (an illegal state). */
export function findRoute(from: CubeState, to: CubeState, timeLimitMs = 200): Promise<SolverMove[] | null> {
  return call({ type: 'route', from, to, timeLimitMs }) as Promise<SolverMove[] | null>;
}
