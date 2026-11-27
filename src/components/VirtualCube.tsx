'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadRecolouredTwisty, recolour3DPlayer } from '@/lib/cube-colors';
import { f2lStickeringMask } from '@/lib/f2l-stickering-mask';
import { ollStickeringMask } from '@/lib/oll-stickering-mask';
import { stateEquals, type CubeState } from '@/lib/smart-cube/cube-state';
import {
  completionStart,
  cubingTransformationData,
  guideHint,
  moveTimeAt,
  turnBetween,
  type NextMove,
} from '@/lib/smart-cube/guide-cube';
import { frameRotation, lastLayerFace, userNotation, type CubeHolding, type Frame } from '@/lib/smart-cube/holding';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

type PlayerElement = HTMLElement & {
  experimentalAddMove(move: string): void;
  experimentalStickeringMaskOrbits: unknown;
  experimentalModel: {
    setupTransformation: { set(transformation: unknown): void };
    timeRange: { get(): Promise<{ start: number; end: number }> };
    timestampRequest: { set(timestamp: number): void };
  };
  jumpToStart(options?: { flash: boolean }): void;
  play(): void;
  pause(): void;
};

/** A guided setup or scramble: the cube as it is now, held as in the guide, and the move to show turning. */
export interface CubeGuide {
  state: CubeState;
  move: NextMove;
}

// PLL shows every colour. cubing.js only repaints the pieces a mask lists, so
// this lists them all rather than passing no mask.
const allRegular = (pieces: number, facelets: number) => ({
  pieces: Array.from({ length: pieces }, () => ({ facelets: Array<string>(facelets).fill('regular') })),
});
const FULL_COLOUR_MASK = { orbits: { CORNERS: allRegular(8, 3), EDGES: allRegular(12, 2), CENTERS: allRegular(6, 4) } };

/** The guide's move turns at this speed (cubing.js's is 1), then rests before it starts again. */
const GUIDE_TEMPO = 0.8;
const REST_BEFORE_MS = 500;
const REST_AFTER_MS = 900;
/**
 * A turn made on the cube plays to its end in this long (a half turn half
 * as long again), less from where the hint stood but never under half, so
 * it reads as a turn; the next turn cuts it short.
 */
const COMPLETE_MS = 240;

const smoothStep = (u: number) => u * u * (3 - 2 * u);

/** Calls `frame` with 0 to 1 over `ms` (one call a frame); false when cancelled first. */
function animate(ms: number, frame: (u: number) => void, cancelled: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (cancelled()) return resolve(false);
      const u = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
      frame(u);
      if (u < 1) requestAnimationFrame(tick);
      else resolve(true);
    };
    tick();
  });
}
const sleep = (ms: number, cancelled: () => boolean) => new Promise<boolean>((resolve) => setTimeout(() => resolve(!cancelled()), ms));

type ShowState = (state: CubeState, frame: Frame) => unknown;
let showStateLoad: Promise<ShowState> | null = null;
/** The state as cubing.js shows it, held in `frame`. */
function loadShowState(): Promise<ShowState> {
  showStateLoad ??= Promise.all([import('cubing/kpuzzle'), import('cubing/puzzles')]).then(async ([{ KTransformation }, { cube3x3x3 }]) => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    return (state: CubeState, frame: Frame) => new KTransformation(kpuzzle, cubingTransformationData(state)).applyAlg(frameRotation(frame));
  });
  return showStateLoad;
}

function applyMask(element: PlayerElement, mask: object) {
  element.experimentalStickeringMaskOrbits = mask;
}

// The smart cube's virtual cube: one twisty-player (one WebGL context) that
// stays mounted while a trainer moves between its screens. Like the case
// views, it shows the hidden faces as floating stickers and greys what the
// practice ignores: the last layer for F2L, all but the top colour for OLL,
// nothing for PLL or a solve.
//
// With a guide (a setup or scramble being turned on the cube, or the cube as
// it is while solving), it shows the cube's own state, held as the guide has
// it, and turns the next move part of the way over and over: a rest, a
// quarter turn to about 45° (a half turn to about 135°), a rest, back to the
// start. A turn made on the cube is played to its end, from where the hint
// stood when it was that move, before the next hint; a turn that comes while
// one plays cuts it short, so nothing falls behind. Otherwise a new case or
// a reset (`resetKey`) jumps to `setupAlg + moves`, and each new move is
// appended so the player animates it.
export function VirtualCube({ practice, holding, setupAlg = '', moves = [], resetKey = 0, guide = null, still = false, className }: {
  /** Null: every colour (a solve from a scramble). */
  practice: TrainerPractice | null;
  holding: CubeHolding | null;
  setupAlg?: string;
  moves?: string[];
  resetKey?: number;
  guide?: CubeGuide | null;
  /** Not turned by dragging: where a press on the screen does something else (the solve's timer). */
  still?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Stickering follows pieces: the last layer is cubing.js's D layer with
  // yellow on top and its U layer with white on top.
  const mask = useMemo(() => {
    if (practice === null || practice === 'pll' || holding === null) return FULL_COLOUR_MASK;
    const ll = lastLayerFace(holding);
    return practice === 'f2l' ? f2lStickeringMask(ll) : ollStickeringMask(ll);
  }, [practice, holding]);
  const [player, setPlayer] = useState<PlayerElement | null>(null);
  const applied = useRef<{ key: number; setup: string; moves: readonly string[] } | null>(null);
  // The guide's state on screen (the end of any turn playing) and how far its hint has turned.
  const shown = useRef<{ state: CubeState; frame: Frame } | null>(null);
  const hint = useRef<{ alg: string; share: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let element: PlayerElement | null = null;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyScheme = (dark: boolean) => element?.setAttribute('color-scheme', dark ? 'dark' : 'light');
    const onScheme = (e: MediaQueryListEvent) => applyScheme(e.matches);
    loadRecolouredTwisty().then(() => {
      const host = hostRef.current;
      if (cancelled || !host) return;
      element = document.createElement('twisty-player') as PlayerElement;
      element.setAttribute('puzzle', '3x3x3');
      element.setAttribute('background', 'none');
      element.setAttribute('control-panel', 'none');
      element.setAttribute('back-view', 'none');
      if (still) element.setAttribute('experimental-drag-input', 'none');
      element.style.width = '100%';
      element.style.height = '100%';
      applyScheme(mq.matches);
      mq.addEventListener('change', onScheme);
      host.appendChild(element);
      void recolour3DPlayer(element as unknown as import('cubing/twisty').TwistyPlayer);
      applied.current = null;
      setPlayer(element);
    });
    return () => {
      cancelled = true;
      mq.removeEventListener('change', onScheme);
      element?.remove();
    };
    // Created once; `still` is fixed for a player's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (player) applyMask(player, mask);
  }, [player, mask]);

  // Moves and setups, when there is no guide.
  useEffect(() => {
    if (!player || guide) return;
    shown.current = null;
    hint.current = null;
    const last = applied.current;
    const fresh = !last || last.key !== resetKey || last.setup !== setupAlg;
    let kept = 0;
    while (!fresh && kept < last.moves.length && kept < moves.length && last.moves[kept] === moves[kept]) kept++;
    if (fresh || kept < last.moves.length) {
      // Jump to the moves kept; those after them are played. A move shown can
      // change: a quarter turn becomes the slice it began once the other face
      // turns, and then the slice is played from where the quarter started.
      const shown = fresh || moves.length <= kept ? moves.length : kept;
      player.experimentalModel.setupTransformation.set(null);
      player.setAttribute('tempo-scale', '1');
      player.setAttribute('experimental-setup-alg', [setupAlg, ...moves.slice(0, shown)].join(' ').trim());
      player.setAttribute('alg', '');
      for (const move of moves.slice(shown)) player.experimentalAddMove(move);
    } else {
      for (const move of moves.slice(kept)) player.experimentalAddMove(move);
    }
    applied.current = { key: resetKey, setup: setupAlg, moves };
  }, [player, guide, setupAlg, moves, resetKey]);

  // The guide: the cube's state, turned to how it is held, the turn just
  // made played to its end, and the next move turned part of the way over
  // and over.
  const state = guide?.state ?? null;
  const frame = guide?.move.frame ?? null;
  const next = guide?.move.alg ?? '';
  useEffect(() => {
    if (!player || !state || !frame) return;
    applied.current = null;
    let cancelled = false;
    const stopped = () => cancelled;
    const model = player.experimentalModel;
    const at = (timestamp: number) => model.timestampRequest.set(timestamp);
    const showAt = async (setup: unknown, alg: string) => {
      player.pause();
      model.setupTransformation.set(setup);
      player.setAttribute('tempo-scale', String(GUIDE_TEMPO));
      player.setAttribute('alg', alg);
      const range = await model.timeRange.get();
      at(range.start);
      return range;
    };
    void loadShowState().then(async (showState) => {
      if (cancelled) return;
      const before = shown.current;
      shown.current = { state, frame };
      const turn = before && !stateEquals(before.state, state) ? turnBetween(before.state, state) : null;
      if (before && turn) {
        // The turn just made, from where its hint stood to the end.
        const move = userNotation(before.frame, turn.face, turn.amount);
        const from = completionStart(hint.current, move);
        hint.current = null;
        const { start, end } = await showAt(showState(before.state, before.frame), move);
        if (cancelled) return;
        const ms = COMPLETE_MS * (turn.amount === 2 ? 1.5 : 1) * Math.max(0.5, 1 - from);
        const done = await animate(ms, (u) => at(start + moveTimeAt(from + (1 - from) * smoothStep(u)) * (end - start)), stopped);
        if (!done) return;
      }
      const { start, end } = await showAt(showState(state, frame), next);
      hint.current = null;
      const stop = guideHint(next);
      if (cancelled || !stop) return;
      // Rotations before the move in full, then the move part of the way, eased in and out.
      const lastStart = Math.max(start, end - stop.lastDuration);
      for (;;) {
        at(start);
        hint.current = { alg: next, share: 0 };
        if (!await sleep(REST_BEFORE_MS, stopped)) return;
        if (lastStart > start && !await animate((lastStart - start) / GUIDE_TEMPO, (u) => at(start + u * (lastStart - start)), stopped)) return;
        const turning = (stop.lastDuration * stop.share) / GUIDE_TEMPO;
        const turned = await animate(turning, (u) => {
          const share = stop.share * smoothStep(u);
          hint.current = { alg: next, share };
          at(lastStart + moveTimeAt(share) * stop.lastDuration);
        }, stopped);
        if (!turned || !await sleep(REST_AFTER_MS, stopped)) return;
      }
    });
    return () => { cancelled = true; };
  }, [player, state, frame, next]);

  return <div ref={hostRef} className={className} />;
}
