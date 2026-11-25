'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSmartCube } from '@/hooks/useSmartCube';
import { stateEquals, type CubeState } from '@/lib/smart-cube/cube-state';
import type { CubeHolding } from '@/lib/smart-cube/holding';
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
}

// The current attempt, outside React so the cube's turns can drive it as they
// arrive; read with useSyncExternalStore.
class SolveHolder {
  session: CubeSolveSession | null = null;
  private screen: CubeSolveScreen | null = null;
  /** The last route asked for: from this state to this target. */
  private requested: { from: CubeState; to: CubeState } | null = null;
  private failedFor: CubeState | null = null;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.screen;
  set(session: CubeSolveSession | null) {
    if (session === this.session) return;
    this.session = session;
    this.screen = session && { ...cubeSolveView(session), routeFailed: this.failedFor !== null && stateEquals(this.failedFor, session.state) };
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
        this.screen = { ...cubeSolveView(current), routeFailed: true };
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
  holding: CubeHolding;
  onStart: () => void;
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

  // A new attempt for each scramble, holding and connection.
  useEffect(() => {
    const state = getCubeSnapshot().state;
    holder.set(on && scramble && state ? startCubeSolve(scramble, holding, state) : null);
  }, [holder, on, scramble, holding]);

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
      holder.set(result.session);
      if (result.event === 'start') callbacks.current.onStart();
      if (result.event === 'stop') {
        callbacks.current.onStop(cubeSolve({ scramble: session.scramble, holding: session.holding, start: session.target, turns: result.session.turns }));
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
