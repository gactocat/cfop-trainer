'use client';

import { useEffect, useRef, useState } from 'react';
import { F2L_STICKERING_MASK } from '@/lib/f2l-stickering-mask';

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
  const [inView, setInView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Each twisty-player holds a WebGL context, and browsers keep only ~16 alive
  // at once. The 41-case grid would blow past that limit and the overflow
  // cards render blank. So only mount a player while its card is on (or near)
  // screen, and unmount when it scrolls away to free the context back up.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { rootMargin: '200px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Load the cubing.js chunk lazily, only once a player is first needed.
  useEffect(() => {
    if (!inView || ready) return;
    let cancelled = false;
    loadTwisty().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [inView, ready]);

  useEffect(() => {
    if (!ready || !inView || !hostRef.current) return;
    const host = hostRef.current;
    const player = document.createElement('twisty-player');
    player.setAttribute('puzzle', '3x3x3');
    // Prefix `x2` so the cube is displayed with yellow on U / white on D and
    // blue on F / red on R — the CFOP orientation we want. (`x2` only recolours
    // the solved cube before `setupAlg` builds the case, so the case geometry
    // is unchanged; it just swaps the front/right faces from green/orange to
    // blue/red versus the previous `z2`.)
    player.setAttribute('experimental-setup-alg', `x2 ${setupAlg}`);
    // `'start'` anchors the setup-alg to the START of the timeline, so the
    // resting (initial) position is exactly `x2 · setupAlg` — the case as
    // shown on speedcubedb. (`'end'` would instead show `setupAlg · alg⁻¹`,
    // i.e. the case with the solution rewound on top of it, which is wrong.)
    // Pressing play then runs `algorithm` forward to solve the case.
    player.setAttribute('experimental-setup-anchor', 'start');
    player.setAttribute('alg', algorithm);
    // cubing.js's built-in "F2L" stickering greys the puzzle's U-layer (white
    // side), but we apply `x2` in setup-alg so the puzzle's D-layer (yellow)
    // ends up on top visually. Pass a custom mask that greys the D-layer
    // instead so the CFOP-style "yellow LL = grey" view comes out correct.
    (player as unknown as { experimentalStickeringMaskOrbits: unknown })
      .experimentalStickeringMaskOrbits = F2L_STICKERING_MASK;
    player.setAttribute('background', 'none');
    player.setAttribute('control-panel', interactive ? 'bottom-row' : 'none');
    player.setAttribute('back-view', 'none');
    player.style.width = '100%';
    player.style.height = '100%';
    host.appendChild(player);
    setMounted(true);

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
      setMounted(false);
    };
  }, [ready, inView, algorithm, setupAlg, interactive]);

  return (
    <div
      ref={hostRef}
      className={`${className ?? ''} ${mounted ? '' : 'rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse'}`.trim()}
      aria-label={mounted ? '3D F2L case' : 'Loading 3D F2L case'}
    />
  );
}
