'use client';

import { useMemo } from 'react';
import { useT } from '@/hooks/useT';
import { STICKER_COLOURS } from '@/lib/cube-colors';
import { applyFaceTurns, FACES, SOLVED, type Face } from '@/lib/smart-cube/cube-state';
import { FACE_COLOUR, type Frame } from '@/lib/smart-cube/holding';
import { facelets } from '@/lib/solve/cfop-split';

// Where each face sits in the unfolded cube, in stickers: U above F, then L F R B, D below.
const ORIGIN: Record<Face, [number, number]> = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };
const STEP = 10;

// The scrambled cube unfolded, as the user holds it: the scramble is turned
// on a cube whose top and front are the holding's colours, so the net shows
// what each face should look like once scrambled.
export function ScrambleNet({ scramble, frame, className = '' }: { scramble: string; frame: Frame; className?: string }) {
  const { t } = useT();
  const stickers = useMemo(() => {
    try {
      return facelets(applyFaceTurns(SOLVED, scramble));
    } catch {
      return null;
    }
  }, [scramble]);
  if (!stickers) return null;
  return (
    <svg viewBox={`-1 -1 ${12 * STEP + 2} ${9 * STEP + 2}`} role="img" aria-label={t('solve.scramble.net')} className={className}>
      {FACES.map((face, f) => {
        const [x0, y0] = ORIGIN[face];
        return Array.from({ length: 9 }, (_, k) => (
          <rect
            key={`${face}${k}`}
            x={(x0 + (k % 3)) * STEP + 0.5}
            y={(y0 + Math.floor(k / 3)) * STEP + 0.5}
            width={STEP - 1}
            height={STEP - 1}
            rx={1.5}
            fill={STICKER_COLOURS[FACE_COLOUR[frame[stickers[f * 9 + k]]]]}
            className="stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth={0.6}
          />
        ));
      })}
    </svg>
  );
}
