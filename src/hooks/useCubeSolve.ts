'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSmartCube } from '@/hooks/useSmartCube';
import { stateEquals, type CubeState } from '@/lib/smart-cube/cube-state';
import { colourFrame, holdingFrame, type ColourHolding } from '@/lib/smart-cube/holding';
import {
  cubeSolveResync,
  cubeSolveTurn,
  cubeSolveView,
  needsRoute,
  startCubeSolve,
  withRoute,
  type CubeSolveSession,
  type CubeSolveView,
} from '@/lib/smart-cube/solve-session';
import { getSnapshot as getCubeSnapshot, subscribe as subscribeCube, subscribeTurns } from '@/lib/smart-cube-store';
import { findRoute } from '@/lib/solve/scramble-client';
import { movesInHolding } from '@/lib/solve/scramble';
import { cubeSolve, type SolveRecord } from '@/lib/solve/solve-record';

export interface CubeSolveScreen extends CubeSolveView {
  /** No legal route from the cube's state (it was misread, or a piece is twisted). */
  routeFailed: boolean;
  /** performance.now() when the cube reached the scrambled state; the inspection runs from here. */
  readySince: number | null;
}

// The current attempt, outside React so the cube's turns can drive it as they
// arrive; read with useSyncExternalStore.
class SolveHolder {
  session: CubeSolveSession | null = null;
  private screen: CubeSolveScreen | null = null;
  /** The last route asked for: from this state to this target. */
  private requested: { from: CubeState; to: CubeState } | null = null;
  private failedFor: CubeState | null = null;
  readySince: number | null = null;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.screen;
  set(session: CubeSolveSession | null) {
    if (session === this.session) return;
    if (session?.phase !== 'ready' && session?.phase !== 'running') this.readySince = null;
    else if (session.phase === 'ready' && this.session?.phase !== 'ready') this.readySince = performance.now();
    this.session = session;
    this.screen = session && {
      ...cubeSolveView(session),
      routeFailed: this.failedFor !== null && stateEquals(this.failedFor, session.state),
      readySince: this.readySince,
    };
    this.listeners.forEach((l) => l());
    if (session && needsRoute(session) && (this.requested?.from !== session.state || this.requested.to !== session.target)) this.askRoute(session);
  }
  // The solver works out a route from where the cube is; the answer counts
  // only if the cube has not moved since.
  private askRoute(session: CubeSolveSession) {
    const from = session.state;
    const to = session.target;
    const request = { from, to };
    this.requested = request;
    findRoute(from, to).then((moves) => {
      const current = this.session;
      if (!current || current.state !== from || current.target !== to || !needsRoute(current)) return;
      const next = withRoute(current, from, moves && movesInHolding(moves, current.holding));
      if (next === current) {
        // No legal route: the cube's state is misread or a piece is twisted.
        this.failedFor = from;
        this.screen = { ...cubeSolveView(current), routeFailed: true, readySince: this.readySince };
        this.listeners.forEach((l) => l());
        return;
      }
      this.failedFor = null;
      this.set(next);
    }, () => {
      if (this.requested === request) this.requested = null;
    });
  }
}

const serverScreen = () => null;

/**
 * A solve from `scramble` on a connected smart cube: guide the scramble turn
 * by turn (working out a new route when the cube is elsewhere), start on the
 * first turn from the scrambled state and stop when solved. Null while no cube
 * is connected, its state is unknown or there is no scramble yet.
 */
export function useCubeSolve({ active, scramble, holding, onStart, onStop }: {
  active: boolean;
  scramble: string | null;
  /** How the cube is held for the scramble. The cross colour is read from the solve. */
  holding: ColourHolding;
  /** The first turn from the scrambled state: how long after reaching it (the inspection). */
  onStart: (inspectionMs: number) => void;
  /** Solved: the record of the solve, timed on the cube's clock. */
  onStop: (record: SolveRecord) => void;
}): { screen: CubeSolveScreen | null; restart: () => void } {
  const cube = useSmartCube();
  const synced = cube.status === 'connected' && cube.state !== null;
  const [holder] = useState(() => new SolveHolder());
  const screen = useSyncExternalStore(holder.subscribe, holder.getSnapshot, serverScreen);
  const callbacks = useRef({ onStart, onStop });
  useEffect(() => { callbacks.current = { onStart, onStop }; });
  const on = active && synced && scramble !== null;
  const { top, front } = holding;
  const frame = useMemo(() => colourFrame({ top, front }) ?? holdingFrame('white-green'), [top, front]);
  const colours = useRef(holding);
  useEffect(() => { colours.current = holding; });

  // A new attempt for each scramble, holding and connection.
  useEffect(() => {
    const state = getCubeSnapshot().state;
    holder.set(on && scramble && state ? startCubeSolve(scramble, frame, state) : null);
  }, [holder, on, scramble, frame]);

  useEffect(() => {
    if (!on) return;
    const offTurns = subscribeTurns((turn) => {
      const session = holder.session;
      if (!session) return;
      const result = cubeSolveTurn(session, turn);
      // Not while a dialog covers the page: guide back to the scramble instead.
      if (result.event === 'start' && document.querySelector('[data-app-overlay]')) {
        holder.set(startCubeSolve(session.scramble, session.holding, turn.state));
        return;
      }
      const readySince = holder.readySince;
      holder.set(result.session);
      if (result.event === 'start') {
        // The inspection on the screen's clock, as its countdown showed it
        // (the cube's clock is for the solve itself).
        callbacks.current.onStart(readySince === null ? 0 : performance.now() - readySince);
      }
      if (result.event === 'stop') {
        const held = colours.current;
        callbacks.current.onStop(cubeSolve({
          scramble: session.scramble, scrambleHolding: { top: held.top, front: held.front },
          start: session.target, turns: result.session.turns,
        }));
      }
    });
    // The cube's state can change without a turn (it resyncs about once a
    // second). A turn updates the store just before it reaches the session,
    // so look once the turn has been handled.
    const offState = subscribeCube(() => {
      queueMicrotask(() => {
        const state = getCubeSnapshot().state;
        const session = holder.session;
        if (state && session && !stateEquals(state, session.state)) holder.set(cubeSolveResync(session, state));
      });
    });
    return () => {
      offTurns();
      offState();
    };
  }, [holder, on]);

  return {
    screen: on ? screen : null,
    // Abandon the attempt: guide from wherever the cube is now.
    restart: () => {
      const session = holder.session;
      const state = getCubeSnapshot().state;
      if (session && state) holder.set(startCubeSolve(session.scramble, session.holding, state));
    },
  };
}
