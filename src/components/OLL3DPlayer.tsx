'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/hooks/useT';
import { rotationNeutral } from '@/lib/cube-rotation';
import { OLL_STICKERING_MASK } from '@/lib/oll-stickering-mask';
import { invertAlg } from '@/lib/invert-alg';
import type { Auf } from '@/types/pll';

export function OLL3DPlayer({ algorithm, auf = 'U0', className }: {
  algorithm: string;
  auf?: Auf;
  className?: string;
}) {
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
      const solution = `${auf === 'U0' ? '' : auf} ${algorithm}`.trim();
      player = new TwistyPlayer({
        puzzle: '3x3x3',
        alg: solution,
        experimentalSetupAlg: `x2 ${invertAlg(rotationNeutral(solution))}`,
        experimentalStickeringMaskOrbits: OLL_STICKERING_MASK,
        background: 'none',
        controlPanel: 'bottom-row',
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
  }, [algorithm, auf]);
  return <div ref={hostRef} className={className} aria-label={t('view.oll3d')} />;
}
