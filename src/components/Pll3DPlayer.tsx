'use client';

import { useLastLayerSettings } from '@/hooks/useLastLayerSettings';
import { buildLastLayerSetup } from '@/lib/last-layer-setup';
import type { Auf } from '@/types/pll';
import { LastLayerPlayer } from './LastLayerPlayer';

export function Pll3DPlayer({ algorithm, auf = 'U0', className }: {
  algorithm: string;
  auf?: Auf;
  className?: string;
}) {
  const { settings } = useLastLayerSettings('pll');
  const setup = buildLastLayerSetup({ algorithm, auf }, settings.aufDisplay);
  return <LastLayerPlayer practice="pll" setupAlg={setup.scramble}
    algorithm={setup.solution} view="3d" className={className} />;
}
