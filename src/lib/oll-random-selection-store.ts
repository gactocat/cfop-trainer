import { createRandomSelectionStore } from '@/lib/random-selection-store';
import { OLL_IDS } from '@/types/oll';

export const { getSnapshot, getServerSnapshot, subscribe, mutate } = createRandomSelectionStore(
  'pll-app:oll-random-selection:v1',
  OLL_IDS,
);
