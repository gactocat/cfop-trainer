'use client';

import { useEffect, useRef, useState } from 'react';
import type { Auf } from '@/types/pll';

interface Pll3DPlayerProps {
  algorithm: string;
  auf?: Auf;
  size?: number;
}

const AUF_TO_SETUP: Record<Auf, string> = {
  U0: '',
  U: 'U',
  U2: 'U2',
  "U'": "U'",
};

export function Pll3DPlayer({ algorithm, auf = 'U0', size = 220 }: Pll3DPlayerProps) {
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
    player.setAttribute('experimental-setup-alg', AUF_TO_SETUP[auf]);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('background', 'none');
    player.setAttribute('control-panel', 'bottom-row');
    player.setAttribute('back-view', 'none');
    player.style.width = '100%';
    player.style.height = '100%';
    host.appendChild(player);
    playerRef.current = player;
    return () => {
      player.remove();
      playerRef.current = null;
    };
  }, [ready, algorithm, auf]);

  return (
    <div
      ref={hostRef}
      style={{ width: size, height: size }}
      className={ready ? '' : 'rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse'}
      aria-label={ready ? '3D cube playback' : 'Loading 3D cube'}
    />
  );
}
