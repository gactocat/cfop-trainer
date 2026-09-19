// Keep the versioned guest formats intact when moving data to an account.
export type AccountData = Record<string, string>;
export const DATA_KEYS = [
  'pll-app:algorithms:v1', 'pll-app:f2l-algorithms:v1', 'pll-app:oll-algorithms:v1',
  'pll-app:random-solves:v1', 'pll-app:f2l-random-solves:v1', 'pll-app:oll-random-solves:v1',
  'pll-app:pll-random-selection:v1', 'pll-app:f2l-random-selection:v1', 'pll-app:oll-random-selection:v1',
  'pll-app:pll-selection-presets:v1', 'pll-app:f2l-selection-presets:v1', 'pll-app:oll-selection-presets:v1',
  'pll-app:locale:v1', 'pll-app:practice-settings:v1',
  'pll-app:f2l-auf-display:v1', 'pll-app:f2l-trainer-mode:v1', 'pll-app:f2l-scramble-settings:v1',
  'pll-app:oll-trainer-settings:v1', 'pll-app:pll-trainer-settings:v1',
] as const;

export function parseAccountData(raw: unknown): AccountData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid account data');
  const data: AccountData = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(DATA_KEYS as readonly string[]).includes(key) || typeof value !== 'string') {
      throw new Error('Unsupported account data');
    }
    data[key] = value;
  }
  return data;
}
