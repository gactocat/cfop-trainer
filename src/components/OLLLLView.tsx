'use client';

import { useEffect, useRef } from 'react';
import { getOLLDefinition } from '@/data/oll-definitions';
import { useT } from '@/hooks/useT';
import { OLL_STICKERING_MASK } from '@/lib/oll-stickering-mask';
import { invertAlg } from '@/lib/invert-alg';
import type { OLLId } from '@/types/oll';
import type { Auf } from '@/types/pll';

interface OLLLLViewProps {
  ollId: OLLId;
  auf?: Auf;
  size?: number;
  className?: string;
}

export function OLLLLView({ ollId, auf = 'U0', size = 120, className }: OLLLLViewProps) {
  const { t } = useT();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: import('cubing/twisty').TwistyPlayer | undefined;
    void import('cubing/twisty').then(({ TwistyPlayer }) => {
      const def = getOLLDefinition(ollId);
      if (cancelled || !def) return;
      // AUF is the move performed BEFORE the solution, so the starting case
      // is the canonical case turned by its inverse.
      const adjustment = auf === 'U0' ? '' : invertAlg(auf);
      player = new TwistyPlayer({
        puzzle: '3x3x3',
        visualization: 'experimental-2D-LL',
        experimentalStickeringMaskOrbits: OLL_STICKERING_MASK,
        experimentalSetupAlg: `x2 ${def.setupAlg} ${adjustment}`.trim(),
        background: 'none',
        controlPanel: 'none',
        hintFacelets: 'none',
      });
      player.style.width = '100%';
      player.style.height = '100%';
      host.appendChild(player);
    });
    return () => {
      cancelled = true;
      player?.remove();
    };
  }, [ollId, auf]);

  return (
    <div
      ref={hostRef}
      style={{ width: size, height: size }}
      className={className}
      aria-label={t('view.ollLL', { id: ollId, auf })}
      role="img"
    />
  );
}
