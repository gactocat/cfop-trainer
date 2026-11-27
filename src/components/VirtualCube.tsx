'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadRecolouredTwisty, recolour3DPlayer } from '@/lib/cube-colors';
import { f2lStickeringMask } from '@/lib/f2l-stickering-mask';
import { ollStickeringMask } from '@/lib/oll-stickering-mask';
import type { CubeState } from '@/lib/smart-cube/cube-state';
import { cubingTransformationData, type NextMove } from '@/lib/smart-cube/guide-cube';
import { frameRotation, lastLayerFace, type CubeHolding } from '@/lib/smart-cube/holding';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

type PlayerElement = HTMLElement & {
  experimentalAddMove(move: string): void;
  experimentalStickeringMaskOrbits: unknown;
  experimentalModel: {
    setupTransformation: { set(transformation: unknown): void };
    timeRange: { get(): Promise<{ start: number; end: number }> };
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

function applyMask(element: PlayerElement, mask: object) {
  element.experimentalStickeringMaskOrbits = mask;
}

// The smart cube's virtual cube: one twisty-player (one WebGL context) that
// stays mounted while a trainer moves between its screens. Like the case
// views, it shows the hidden faces as floating stickers and greys what the
// practice ignores: the last layer for F2L, all but the top colour for OLL,
// nothing for PLL or a solve.
//
// With a guide (a setup or scramble being turned on the cube), it shows the
// cube's own state, held as the guide has it, and turns the next move over
// and over: the move, a rest, back to the start. Otherwise a new case or a
// reset (`resetKey`) jumps to `setupAlg + moves`, and each new move is
// appended so the player animates it.
export function VirtualCube({ practice, holding, setupAlg = '', moves = [], resetKey = 0, guide = null, className }: {
  /** Null: every colour (a solve from a scramble). */
  practice: TrainerPractice | null;
  holding: CubeHolding | null;
  setupAlg?: string;
  moves?: string[];
  resetKey?: number;
  guide?: CubeGuide | null;
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
  const applied = useRef<{ key: number; setup: string; count: number } | null>(null);

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
  }, []);

  useEffect(() => {
    if (player) applyMask(player, mask);
  }, [player, mask]);

  // Moves and setups, when there is no guide.
  useEffect(() => {
    if (!player || guide) return;
    const last = applied.current;
    if (!last || last.key !== resetKey || last.setup !== setupAlg || moves.length < last.count) {
      // Jump: the setup includes the moves already made, nothing left to play.
      player.experimentalModel.setupTransformation.set(null);
      player.setAttribute('tempo-scale', '1');
      player.setAttribute('experimental-setup-alg', [setupAlg, ...moves].join(' ').trim());
      player.setAttribute('alg', '');
    } else {
      for (const move of moves.slice(last.count)) player.experimentalAddMove(move);
    }
    applied.current = { key: resetKey, setup: setupAlg, count: moves.length };
  }, [player, guide, setupAlg, moves, resetKey]);

  // The guide: the cube's state, turned to how it is held, and its next move
  // turned over and over.
  const state = guide?.state ?? null;
  const frame = guide?.move.frame ?? null;
  const next = guide?.move.alg ?? '';
  useEffect(() => {
    if (!player || !state || !frame) return;
    applied.current = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void Promise.all([import('cubing/kpuzzle'), import('cubing/puzzles')]).then(async ([{ KTransformation }, { cube3x3x3 }]) => {
      const kpuzzle = await cube3x3x3.kpuzzle();
      if (cancelled) return;
      const shown = new KTransformation(kpuzzle, cubingTransformationData(state)).applyAlg(frameRotation(frame));
      player.pause();
      player.experimentalModel.setupTransformation.set(shown);
      player.setAttribute('tempo-scale', String(GUIDE_TEMPO));
      player.setAttribute('alg', next);
      player.jumpToStart({ flash: false });
      if (!next) return;
      const { start, end } = await player.experimentalModel.timeRange.get();
      const turning = (end - start) / GUIDE_TEMPO;
      const again = () => {
        if (cancelled) return;
        player.jumpToStart({ flash: false });
        timer = setTimeout(() => {
          if (cancelled) return;
          player.play();
          timer = setTimeout(again, turning + REST_AFTER_MS);
        }, REST_BEFORE_MS);
      };
      again();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [player, state, frame, next]);

  return <div ref={hostRef} className={className} />;
}
