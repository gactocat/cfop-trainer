// How an algorithm's AUF is presented in the F2L views:
//   'cube'   — bake the AUF into the displayed cube; show the algorithm body
//              without a leading U turn (AUF shown as a separate chip).
//   'prefix' — show the cube as the raw case (no AUF); prepend the AUF turn
//              to the algorithm string instead.
export type F2LAufDisplayMode = 'cube' | 'prefix';

const STORAGE_KEY = 'pll-app:f2l-auf-display:v1';
const DEFAULT_MODE: F2LAufDisplayMode = 'cube';

let cached: F2LAufDisplayMode | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): F2LAufDisplayMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  return window.localStorage.getItem(STORAGE_KEY) === 'prefix' ? 'prefix' : 'cube';
}

function writeToStorage(mode: F2LAufDisplayMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function getSnapshot(): F2LAufDisplayMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): F2LAufDisplayMode {
  return DEFAULT_MODE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMode(mode: F2LAufDisplayMode): void {
  if (mode === getSnapshot()) return;
  cached = mode;
  writeToStorage(mode);
  listeners.forEach((l) => l());
}
