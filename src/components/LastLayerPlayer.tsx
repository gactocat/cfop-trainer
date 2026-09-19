'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/hooks/useT';
import type { LastLayerPractice } from '@/types/practice';
import { OLL_STICKERING_MASK } from '@/lib/oll-stickering-mask';

interface LastLayerPlayerProps {
  practice: LastLayerPractice;
  setupAlg: string;
  algorithm?: string;
  size?: number;
  className?: string;
  view?: '2d' | '3d';
}

// Lists use SVG-only LL views. WebGL is mounted only for an explicit 3D preview.
export function LastLayerPlayer({
  practice, setupAlg, algorithm = '', size, className, view = '2d',
}: LastLayerPlayerProps) {
  const { t } = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: import('cubing/twisty').TwistyPlayer | undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyScheme = () => player?.setAttribute('color-scheme', mq.matches ? 'dark' : 'light');
    void import('cubing/twisty').then(({ TwistyPlayer }) => {
      if (cancelled) return;
      player = new TwistyPlayer({
        puzzle: '3x3x3',
        visualization: view === '2d' ? 'experimental-2D-LL' : '3D',
        alg: algorithm,
        experimentalSetupAlg: `x2 ${setupAlg}`,
        experimentalSetupAnchor: 'start',
        experimentalStickeringMaskOrbits: practice === 'oll' ? OLL_STICKERING_MASK : undefined,
        background: 'none',
        controlPanel: view === '2d' ? 'none' : 'bottom-row',
        hintFacelets: 'none',
        backView: 'none',
      });
      player.style.width = '100%';
      player.style.height = '100%';
      applyScheme();
      mq.addEventListener('change', applyScheme);
      host.appendChild(player);
    });
    return () => {
      cancelled = true;
      mq.removeEventListener('change', applyScheme);
      player?.remove();
    };
  }, [practice, setupAlg, algorithm, view]);
  return (
    <div
      ref={hostRef}
      style={size === undefined ? undefined : { width: size, height: size }}
      className={className}
      role="img"
      aria-label={t(view === '2d' ? 'view.lastLayer2d' : 'view.lastLayer3d', { kind: practice.toUpperCase() })}
    />
  );
}
