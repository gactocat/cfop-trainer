import { createRandomSelectionStore } from '@/lib/random-selection-store';
import { F2L_IDS } from '@/types/f2l';

export const { getSnapshot, getServerSnapshot, subscribe, mutate } = createRandomSelectionStore(
  'pll-app:f2l-random-selection:v1',
  F2L_IDS,
);
