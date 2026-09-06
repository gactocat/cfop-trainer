import { createSelectionPresetsStore } from '@/lib/selection-presets-store';
import { F2L_IDS, type F2LId } from '@/types/f2l';

export const f2lSelectionPresets = createSelectionPresetsStore<F2LId>(
  'pll-app:f2l-selection-presets:v1',
  (value): value is F2LId => typeof value === 'string' && (F2L_IDS as string[]).includes(value),
);
