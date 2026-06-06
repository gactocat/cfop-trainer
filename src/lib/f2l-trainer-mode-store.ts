// Which flow the F2L random trainer runs:
//   'standard' — pick a hidden case and start timing immediately.
//   'inverse'  — first show the inverse of the algorithm so the user can
//                scramble their own cube into the case, then START to time.
export type F2LTrainerMode = 'standard' | 'inverse';

const STORAGE_KEY = 'pll-app:f2l-trainer-mode:v1';
const DEFAULT_MODE: F2LTrainerMode = 'standard';

let cached: F2LTrainerMode | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): F2LTrainerMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  return window.localStorage.getItem(STORAGE_KEY) === 'inverse' ? 'inverse' : 'standard';
}

function writeToStorage(mode: F2LTrainerMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function getSnapshot(): F2LTrainerMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  if (cached === null) cached = readFromStorage();
  return cached;
}

export function getServerSnapshot(): F2LTrainerMode {
  return DEFAULT_MODE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMode(mode: F2LTrainerMode): void {
  if (mode === getSnapshot()) return;
  cached = mode;
  writeToStorage(mode);
  listeners.forEach((l) => l());
}
