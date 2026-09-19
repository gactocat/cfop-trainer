'use client';

import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { buildLastLayerSetup } from '@/lib/last-layer-setup';
import type { PllId } from '@/types/pll';
import type { Auf } from '@/types/pll';
import { LastLayerPlayer } from './LastLayerPlayer';

export function PllLLView({ pllId, algorithm, auf, size = 120, className }: {
  pllId: PllId;
  algorithm?: string;
  auf?: Auf;
  size?: number;
  className?: string;
}) {
  const { settings } = usePracticeSettings();
  const fallback = splitAuf(PRESET_ALGORITHMS[pllId][0]);
  const setup = buildLastLayerSetup({
    algorithm: algorithm ?? fallback.rest,
    auf: auf ?? fallback.auf,
  }, settings.aufDisplay);
  return <LastLayerPlayer practice="pll" setupAlg={setup.scramble} size={size} className={className} />;
}
