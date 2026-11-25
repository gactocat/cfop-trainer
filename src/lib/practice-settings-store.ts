import { readStoredValue } from '@/lib/persistence';
import { createLocalStore } from '@/lib/local-store';
import type { Practice } from '@/types/practice';

export type AufDisplay = 'cube' | 'prefix';

export interface PracticeSettings {
  /**
   * The one AUF display from before each list had its own. Older versions
   * use it everywhere; a list without its own choice still follows it.
   */
  aufDisplay: AufDisplay;
  /**
   * Each list's AUF display, chosen while selecting its cases. Absent in
   * older versions, which drop it when they save, so the lists then follow
   * aufDisplay again.
   */
  aufDisplays?: Partial<Record<Practice, AufDisplay>>;
  trainerMode: 'standard' | 'inverse';
  randomAuf: boolean;
  /**
   * Start each case with its algorithm's AUF already turned. Overrides
   * randomAuf; absent in older versions, which then see randomAuf (false).
   */
  alignAuf?: boolean;
  colorTheme?: 'light' | 'dark';
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  aufDisplay: 'cube',
  trainerMode: 'standard',
  randomAuf: true,
};

const PRACTICES: readonly Practice[] = ['f2l', 'oll', 'pll'];
const isAufDisplay = (value: unknown): value is AufDisplay => value === 'cube' || value === 'prefix';

function validAufDisplays(raw: unknown): Partial<Pick<PracticeSettings, 'aufDisplays'>> {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Record<string, unknown>;
  const lists = PRACTICES.filter((practice) => isAufDisplay(value[practice]));
  return lists.length
    ? { aufDisplays: Object.fromEntries(lists.map((practice) => [practice, value[practice]])) }
    : {};
}

function validSettings(raw: unknown): Partial<PracticeSettings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Partial<PracticeSettings>;
  return {
    ...(isAufDisplay(value.aufDisplay) ? { aufDisplay: value.aufDisplay } : {}),
    ...validAufDisplays(value.aufDisplays),
    ...(value.trainerMode === 'standard' || value.trainerMode === 'inverse' ? { trainerMode: value.trainerMode } : {}),
    ...(typeof value.randomAuf === 'boolean' ? { randomAuf: value.randomAuf } : {}),
    ...(typeof value.alignAuf === 'boolean' ? { alignAuf: value.alignAuf } : {}),
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
export function update(patch: Partial<Omit<PracticeSettings, 'aufDisplays'>>): void {
  store.mutate((prev) => {
    const next = { ...prev, ...patch };
    return next.aufDisplay === prev.aufDisplay && next.trainerMode === prev.trainerMode &&
      next.randomAuf === prev.randomAuf && next.alignAuf === prev.alignAuf && next.colorTheme === prev.colorTheme ? prev : next;
  });
}

/** How `practice`'s list, case pages and practice show the AUF. */
export function aufDisplayOf(settings: Pick<PracticeSettings, 'aufDisplay' | 'aufDisplays'>, practice: Practice): AufDisplay {
  return settings.aufDisplays?.[practice] ?? settings.aufDisplay;
}

/**
 * Choose one list's AUF display. The shared aufDisplay is left as it was,
 * so older versions keep showing what they showed before.
 */
export function setAufDisplay(practice: Practice, display: AufDisplay): void {
  store.mutate((prev) => aufDisplayOf(prev, practice) === display
    ? prev
    : { ...prev, aufDisplays: { ...prev.aufDisplays, [practice]: display } });
}
