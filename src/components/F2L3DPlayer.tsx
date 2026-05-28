'use client';

import { useEffect, useRef, useState } from 'react';

interface F2L3DPlayerProps {
  algorithm: string;
  setupAlg: string;
  className?: string;
  // When false, hides playback controls — used by the grid cards so the
  // case reads as a static image. Detail pages pass true.
  interactive?: boolean;
}

// A single shared import promise so 41+ grid instances share one chunk load.
let twistyPromise: Promise<unknown> | null = null;
function loadTwisty(): Promise<unknown> {
  if (twistyPromise === null) twistyPromise = import('cubing/twisty');
  return twistyPromise;
}

export function F2L3DPlayer({
  algorithm,
  setupAlg,
  className,
  interactive = true,
}: F2L3DPlayerProps) {
  const [ready, setReady] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTwisty().then(() => {
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
    player.setAttribute('puzzle', '3x3x3');
    // The case lives at the end of the setup, before the algorithm runs.
    player.setAttribute('experimental-setup-alg', setupAlg);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('alg', algorithm);
    player.setAttribute('experimental-stickering', 'F2L');
    player.setAttribute('background', 'none');
    player.setAttribute('control-panel', interactive ? 'bottom-row' : 'none');
    player.setAttribute('back-view', 'none');
    player.style.width = '100%';
    player.style.height = '100%';
    host.appendChild(player);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyScheme = (matches: boolean) => {
      player.setAttribute('color-scheme', matches ? 'dark' : 'light');
    };
    applyScheme(mq.matches);
    const onSchemeChange = (e: MediaQueryListEvent) => applyScheme(e.matches);
    mq.addEventListener('change', onSchemeChange);

    return () => {
      mq.removeEventListener('change', onSchemeChange);
      player.remove();
    };
  }, [ready, algorithm, setupAlg, interactive]);

  return (
    <div
      ref={hostRef}
      className={`${className ?? ''} ${ready ? '' : 'rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse'}`.trim()}
      aria-label={ready ? '3D F2L case' : 'Loading 3D F2L case'}
    />
  );
}
