'use client';

import { useT } from '@/hooks/useT';
import type { MessageKey } from '@/i18n/messages';
import { STICKER_COLOURS } from '@/lib/cube-colors';
import type { CubeColour } from '@/lib/smart-cube/holding';

export const COLOUR_LABEL: Record<CubeColour, MessageKey> = {
  white: 'solve.colour.white',
  yellow: 'solve.colour.yellow',
  red: 'solve.colour.red',
  orange: 'solve.colour.orange',
  green: 'solve.colour.green',
  blue: 'solve.colour.blue',
};

// A small square of a cube colour, named for screen readers: the cross's
// colour beside a solve's Cross.
export function CubeColourMark({ colour, className = 'size-2.5' }: { colour: CubeColour; className?: string }) {
  const { t } = useT();
  return (
    <span
      role="img"
      aria-label={t(COLOUR_LABEL[colour])}
      title={t(COLOUR_LABEL[colour])}
      className={`inline-block shrink-0 rounded-sm ring-1 ring-zinc-300 dark:ring-zinc-600 ${className}`}
      style={{ backgroundColor: STICKER_COLOURS[colour] }}
    />
  );
}
