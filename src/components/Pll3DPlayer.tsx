'use client';

import { useEffect, useRef, useState } from 'react';
import type { Auf } from '@/types/pll';

interface Pll3DPlayerProps {
  algorithm: string;
  auf?: Auf;
  className?: string;
}

const AUF_TO_SETUP: Record<Auf, string> = {
  U0: '',
  U: 'U',
  U2: 'U2',
  "U'": "U'",
};

export function Pll3DPlayer({ algorithm, auf = 'U0', className }: Pll3DPlayerProps) {
  const [ready, setReady] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('cubing/twisty').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hostRef.current) return;
    const host = hostRef.current;
    const player = document.createElement('twisty-player');
    player.setAttribute('alg', algorithm);
    // Prefix `z2` so the cube renders with yellow on U / white on D — the
    // standard CFOP orientation that matches our 2D LL view and the
    // reference diagrams users learn the cases from.
    player.setAttribute(
      'experimental-setup-alg',
      `z2 ${AUF_TO_SETUP[auf]}`.trim(),
    );
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('background', 'none');
    player.setAttribute('control-panel', 'bottom-row');
    player.setAttribute('back-view', 'none');
    player.style.width = '100%';
    player.style.height = '100%';
    host.appendChild(player);
    playerRef.current = player;

    // Mirror the page's prefers-color-scheme so the player's built-in dark
    // styling (translucent buttons, darker scrubber) blends with the
    // zinc-900 card surrounding it.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyScheme = (matches: boolean) => {
      player.setAttribute('color-scheme', matches ? 'dark' : 'light');
    };
    applyScheme(mq.matches);
    mq.addEventListener('change', (e) => applyScheme(e.matches));

    return () => {
      player.remove();
      playerRef.current = null;
    };
  }, [ready, algorithm, auf]);

  return (
    <div
      ref={hostRef}
      className={`${className ?? ''} ${ready ? '' : 'rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse'}`.trim()}
      aria-label={ready ? '3D cube playback' : 'Loading 3D cube'}
    />
  );
}
