'use client';

import { usePracticeSettings } from '@/hooks/usePracticeSettings';
import { buildLastLayerSetup } from '@/lib/last-layer-setup';
import type { Auf } from '@/types/pll';
import { LastLayerPlayer } from './LastLayerPlayer';

export function OLL3DPlayer({ algorithm, auf = 'U0', className }: {
  algorithm: string;
  auf?: Auf;
  className?: string;
}) {
  const { settings } = usePracticeSettings();
  const setup = buildLastLayerSetup({ algorithm, auf }, settings.aufDisplay);
  return <LastLayerPlayer practice="oll" setupAlg={setup.scramble}
    algorithm={setup.solution} view="3d" className={className} />;
}
