'use client';

import { useEffect, useRef, useState } from 'react';
import { getPllPermutation } from '@/data/pll-definitions';
import type { Auf, PllId } from '@/types/pll';

interface PllLLViewProps {
  pllId: PllId;
  auf?: Auf;
  size?: number;
  className?: string;
}

const AUF_TO_ALG: Record<Auf, string> = {
  U0: '',
  U: 'U',
  U2: 'U2',
  "U'": "U'",
};

// Our U-layer index -> cubing 3x3x3 kpuzzle slot index.
//   Corners (cubing): 0=UFR 1=UBR 2=UBL 3=UFL
//   Edges   (cubing): 0=UF  1=UR  2=UB  3=UL
const CORNER_SLOT = [2, 1, 0, 3];
const EDGE_SLOT = [2, 1, 0, 3];

export function PllLLView({ pllId, auf = 'U0', size = 120, className }: PllLLViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mod, setMod] = useState<{
    TwistyPlayer: typeof import('cubing/twisty').TwistyPlayer;
    cube3x3x3: typeof import('cubing/puzzles').cube3x3x3;
    KTransformation: typeof import('cubing/kpuzzle').KTransformation;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import('cubing/twisty'),
      import('cubing/puzzles'),
      import('cubing/kpuzzle'),
    ]).then(([twisty, puzzles, kpuzzle]) => {
      if (!cancelled)
        setMod({
          TwistyPlayer: twisty.TwistyPlayer,
          cube3x3x3: puzzles.cube3x3x3,
          KTransformation: kpuzzle.KTransformation,
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mod || !hostRef.current) return;
    const host = hostRef.current;
    let player: import('cubing/twisty').TwistyPlayer | null = null;
    let cancelled = false;

    (async () => {
      const kpuzzle = await mod.cube3x3x3.kpuzzle();
      if (cancelled) return;

      const { cornerAt, edgeAt } = getPllPermutation(pllId);
      const cornerPerm = [0, 1, 2, 3, 4, 5, 6, 7];
      const edgePerm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      for (let i = 0; i < 4; i++) cornerPerm[CORNER_SLOT[i]] = CORNER_SLOT[cornerAt[i]];
      for (let i = 0; i < 4; i++) edgePerm[EDGE_SLOT[i]] = EDGE_SLOT[edgeAt[i]];

      const caseTransform = new mod.KTransformation(kpuzzle, {
        CORNERS: { permutation: cornerPerm, orientationDelta: Array(8).fill(0) },
        EDGES: { permutation: edgePerm, orientationDelta: Array(12).fill(0) },
        CENTERS: { permutation: [0, 1, 2, 3, 4, 5], orientationDelta: [0, 0, 0, 0, 0, 0] },
      });

      const aufAlg = AUF_TO_ALG[auf];
      const setupTransform = aufAlg
        ? caseTransform.applyTransformation(kpuzzle.algToTransformation(aufAlg))
        : caseTransform;

      player = new mod.TwistyPlayer({
        puzzle: '3x3x3',
        visualization: 'experimental-2D-LL',
        experimentalStickering: 'PLL',
        background: 'none',
        controlPanel: 'none',
        hintFacelets: 'none',
      });
      player.experimentalModel.setupTransformation.set(setupTransform);
      player.style.width = '100%';
      player.style.height = '100%';
      host.appendChild(player);
    })();

    return () => {
      cancelled = true;
      player?.remove();
    };
  }, [mod, pllId, auf]);

  return (
    <div
      ref={hostRef}
      style={{ width: size, height: size }}
      className={`${className ?? ''} ${mod ? '' : 'rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse'}`.trim()}
      aria-label={`${pllId} PLL (${auf})`}
      role="img"
    />
  );
}
