import { createSelectionPresetsStore } from '@/lib/selection-presets-store';
import { PLL_IDS, type PllId } from '@/types/pll';

export const pllSelectionPresets = createSelectionPresetsStore<PllId>(
  'pll-app:pll-selection-presets:v1',
  (value): value is PllId => typeof value === 'string' && (PLL_IDS as string[]).includes(value),
);
