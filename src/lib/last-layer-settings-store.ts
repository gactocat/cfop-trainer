import { createLocalStore } from '@/lib/local-store';

export type LastLayerPractice = 'oll' | 'pll';
export interface LastLayerSettings {
  aufDisplay: 'cube' | 'prefix';
  trainerMode: 'standard' | 'inverse';
  randomAuf: boolean;
}

export const DEFAULT_LAST_LAYER_SETTINGS: LastLayerSettings = {
  aufDisplay: 'cube',
  trainerMode: 'standard',
  randomAuf: false,
};

function createLastLayerSettingsStore(practice: LastLayerPractice) {
  const store = createLocalStore<LastLayerSettings>(
    `pll-app:${practice}-trainer-settings:v1`,
    DEFAULT_LAST_LAYER_SETTINGS,
    (raw) => {
      const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<LastLayerSettings>;
      return {
        aufDisplay: value.aufDisplay === 'prefix' ? 'prefix' : 'cube',
        trainerMode: value.trainerMode === 'inverse' ? 'inverse' : 'standard',
        randomAuf: value.randomAuf === true,
      };
    },
  );
  return {
    ...store,
    update: (patch: Partial<LastLayerSettings>) => store.mutate((prev) => ({ ...prev, ...patch })),
  };
}

export const lastLayerSettingsStores = {
  oll: createLastLayerSettingsStore('oll'),
  pll: createLastLayerSettingsStore('pll'),
};
