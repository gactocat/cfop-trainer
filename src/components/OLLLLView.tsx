'use client';

import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { useAufDisplay } from '@/hooks/usePracticeSettings';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { buildLastLayerSetup } from '@/lib/last-layer-setup';
import type { OLLId } from '@/types/oll';
import type { Auf } from '@/types/pll';
import { LastLayerPlayer } from './LastLayerPlayer';

export function OLLLLView({ ollId, algorithm, auf, size = 120, className }: {
  ollId: OLLId;
  algorithm?: string;
  auf?: Auf;
  size?: number;
  className?: string;
}) {
  const { aufDisplay } = useAufDisplay('oll');
  const fallback = splitAuf(OLL_PRESET_ALGORITHMS[ollId][0]);
  const setup = buildLastLayerSetup({
    algorithm: algorithm ?? fallback.rest,
    auf: auf ?? fallback.auf,
  }, aufDisplay);
  return <LastLayerPlayer practice="oll" setupAlg={setup.scramble} size={size} className={className} />;
}
