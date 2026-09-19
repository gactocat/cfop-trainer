import { createSelectionPresetsStore } from '@/lib/selection-presets-store';
import { OLL_IDS, type OLLId } from '@/types/oll';

export const ollSelectionPresets = createSelectionPresetsStore<OLLId>(
  'pll-app:oll-selection-presets:v1',
  (value): value is OLLId => typeof value === 'string' && (OLL_IDS as string[]).includes(value),
);
