'use client';

import { useEffect, useRef, useState } from 'react';
import { loadRecolouredTwisty, recolour3DPlayer } from '@/lib/cube-colors';

type PlayerElement = HTMLElement & { experimentalAddMove(move: string): void };

// The no-scramble virtual cube: one twisty-player (one WebGL context) that
// stays mounted while the trainer moves between its screens. A new case or a
// reset (`resetKey`) jumps to `setupAlg + moves`; otherwise each new move is
// appended so the player animates it.
export function VirtualCube({ setupAlg, moves, resetKey, className }: {
  setupAlg: string;
  moves: string[];
  resetKey: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
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
      element.setAttribute('hint-facelets', 'none');
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
