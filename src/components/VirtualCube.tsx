'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadRecolouredTwisty, recolour3DPlayer } from '@/lib/cube-colors';
import { f2lStickeringMask } from '@/lib/f2l-stickering-mask';
import { ollStickeringMask } from '@/lib/oll-stickering-mask';
import { lastLayerFace, type CubeHolding } from '@/lib/smart-cube/holding';
import type { TrainerPractice } from '@/lib/smart-cube/trainer-session';

type PlayerElement = HTMLElement & {
  experimentalAddMove(move: string): void;
  experimentalStickeringMaskOrbits: unknown;
};

// Assigning undefined would not clear a mask, so "no mask" is an empty one.
function applyMask(element: PlayerElement, mask: object | null) {
  element.experimentalStickeringMaskOrbits = mask ?? { orbits: {} };
}

// The no-scramble virtual cube: one twisty-player (one WebGL context) that
// stays mounted while the trainer moves between its screens. A new case or a
// reset (`resetKey`) jumps to `setupAlg + moves`; otherwise each new move is
// appended so the player animates it. Like the case views, it shows the
// hidden faces as floating stickers and greys what the practice ignores:
// the last layer for F2L, all but the top colour for OLL, nothing for PLL.
export function VirtualCube({ practice, holding, setupAlg, moves, resetKey, className }: {
  practice: TrainerPractice;
  holding: CubeHolding;
  setupAlg: string;
  moves: string[];
  resetKey: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Stickering follows pieces: the last layer is cubing.js's D layer with
  // yellow on top and its U layer with white on top.
  const mask = useMemo(() => {
    const ll = lastLayerFace(holding);
    return practice === 'f2l' ? f2lStickeringMask(ll) : practice === 'oll' ? ollStickeringMask(ll) : null;
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

  useEffect(() => {
    if (!player) return;
    const last = applied.current;
    if (!last || last.key !== resetKey || last.setup !== setupAlg || moves.length < last.count) {
      // Jump: the setup includes the moves already made, nothing left to play.
      player.setAttribute('experimental-setup-alg', [setupAlg, ...moves].join(' ').trim());
      player.setAttribute('alg', '');
    } else {
      for (const move of moves.slice(last.count)) player.experimentalAddMove(move);
    }
    applied.current = { key: resetKey, setup: setupAlg, count: moves.length };
  }, [player, setupAlg, moves, resetKey]);

  return <div ref={hostRef} className={className} />;
}
