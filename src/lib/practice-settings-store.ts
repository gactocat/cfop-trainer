import { readStoredValue } from '@/lib/persistence';
import { createLocalStore } from '@/lib/local-store';

export interface PracticeSettings {
  aufDisplay: 'cube' | 'prefix';
  trainerMode: 'standard' | 'inverse';
  randomAuf: boolean;
  colorTheme?: 'light' | 'dark';
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  aufDisplay: 'cube',
  trainerMode: 'standard',
  randomAuf: true,
};

function validSettings(raw: unknown): Partial<PracticeSettings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Partial<PracticeSettings>;
  return {
    ...(value.aufDisplay === 'cube' || value.aufDisplay === 'prefix' ? { aufDisplay: value.aufDisplay } : {}),
    ...(value.trainerMode === 'standard' || value.trainerMode === 'inverse' ? { trainerMode: value.trainerMode } : {}),
    ...(typeof value.randomAuf === 'boolean' ? { randomAuf: value.randomAuf } : {}),
    ...(value.colorTheme === 'light' || value.colorTheme === 'dark' ? { colorTheme: value.colorTheme } : {}),
  };
}

// Merge explicit legacy preferences field by field, preferring F2L, then OLL,
// then PLL. Old keys are left intact; future edits use only the shared key.
function readLegacySettings(): PracticeSettings {
  const read = (key: string): string | null => {
    try { return readStoredValue(key); } catch { return null; }
  };
  const readJSON = (key: string): unknown => {
    try { return JSON.parse(read(key) ?? 'null'); } catch { return null; }
  };
  const f2l = {
    ...validSettings(readJSON('pll-app:f2l-scramble-settings:v1')),
    ...validSettings({
      aufDisplay: read('pll-app:f2l-auf-display:v1'),
      trainerMode: read('pll-app:f2l-trainer-mode:v1'),
    }),
  };
  return {
    ...DEFAULT_PRACTICE_SETTINGS,
    ...validSettings(readJSON('pll-app:pll-trainer-settings:v1')),
    ...validSettings(readJSON('pll-app:oll-trainer-settings:v1')),
    ...f2l,
  };
}

const store = createLocalStore<PracticeSettings>(
  'pll-app:practice-settings:v1',
  DEFAULT_PRACTICE_SETTINGS,
  (raw) => ({ ...DEFAULT_PRACTICE_SETTINGS, ...validSettings(raw) }),
  { missing: readLegacySettings },
);

export const { getSnapshot, getServerSnapshot, subscribe } = store;
export function update(patch: Partial<PracticeSettings>): void {
  store.mutate((prev) => {
    const next = { ...prev, ...patch };
    return next.aufDisplay === prev.aufDisplay && next.trainerMode === prev.trainerMode &&
      next.randomAuf === prev.randomAuf && next.colorTheme === prev.colorTheme ? prev : next;
  });
}
