'use client';

import { useEffect, useRef, useState } from 'react';
import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import { useT } from '@/hooks/useT';
import { aufToMove, prefixAuf } from '@/lib/f2l-auf';
import { F2L_STICKERING_MASK } from '@/lib/f2l-stickering-mask';
import type { Auf } from '@/types/pll';

interface F2L3DPlayerProps {
  algorithm: string;
  setupAlg: string;
  // U-face adjustment applied to the displayed case so the (AUF-stripped)
  // algorithm body solves it directly. Defaults to no adjustment.
  auf?: Auf;
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
  auf = 'U0',
  className,
  interactive = true,
}: F2L3DPlayerProps) {
  const { t } = useT();
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { mode: aufMode } = useF2LAufDisplay();
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
    // Two ways to present the AUF, picked by the global setting:
    //   'cube'   — bake the AUF into the displayed case (trailing U turn on
    //              the setup) and play just the algorithm body.
    //   'prefix' — leave the case raw and play `AUF + body`, so the AUF reads
    //              as the leading turn of the algorithm instead.
    const aufMove = aufToMove(auf);
    const setupWithAuf =
      aufMode === 'cube' && aufMove ? `x2 ${setupAlg} ${aufMove}` : `x2 ${setupAlg}`;
    const playAlg = aufMode === 'prefix' ? prefixAuf(auf, algorithm) : algorithm;
    player.setAttribute('experimental-setup-alg', setupWithAuf);
    // `'start'` anchors the setup-alg to the START of the timeline, so the
    // resting (initial) position is the case (adjusted by the AUF in 'cube'
    // mode). Pressing play runs the algorithm forward to solve it.
    player.setAttribute('experimental-setup-anchor', 'start');
    player.setAttribute('alg', playAlg);
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
  }, [ready, inView, algorithm, setupAlg, auf, aufMode, interactive]);

  return (
    <div
      ref={hostRef}
      className={`${className ?? ''} ${mounted ? '' : 'rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse'}`.trim()}
      aria-label={mounted ? t('view.f2l3d') : t('view.f2l3dLoading')}
    />
  );
}
