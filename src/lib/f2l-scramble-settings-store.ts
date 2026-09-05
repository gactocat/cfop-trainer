import { DEFAULT_F2L_SCRAMBLE_SETTINGS, type F2LScrambleSettings } from '@/lib/f2l-scramble';

// Persisted settings for the inverse-setup scramble (see lib/f2l-scramble.ts).
// The stored JSON may carry fields from older versions (e.g. `style`); they
// are ignored.
const STORAGE_KEY = 'pll-app:f2l-scramble-settings:v1';

let cached: F2LScrambleSettings | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): F2LScrambleSettings {
  if (typeof window === 'undefined') return DEFAULT_F2L_SCRAMBLE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_F2L_SCRAMBLE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<F2LScrambleSettings>;
    return {
      randomAuf:
        typeof parsed.randomAuf === 'boolean'
          ? parsed.randomAuf
          : DEFAULT_F2L_SCRAMBLE_SETTINGS.randomAuf,
    };
  } catch {
    return DEFAULT_F2L_SCRAMBLE_SETTINGS;
  }
}

function writeToStorage(settings: F2LScrambleSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getSnapshot(): F2LScrambleSettings {
  if (typeof window === 'undefined') return DEFAULT_F2L_SCRAMBLE_SETTINGS;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): F2LScrambleSettings {
  return DEFAULT_F2L_SCRAMBLE_SETTINGS;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function update(patch: Partial<F2LScrambleSettings>): void {
  const prev = getSnapshot();
  const next = { ...prev, ...patch };
  if (next.randomAuf === prev.randomAuf) return;
  cached = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}
