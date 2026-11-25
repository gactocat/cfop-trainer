// Practice options kept on this device only, like the smart cube's: they
// live in localStorage directly and never enter the account document.
const STORAGE_KEY = 'cfop:practice-options:v1';

export interface PracticeOptions {
  /** Random practice deals each selected case once, then shows the session's figures. */
  eachOnce: boolean;
}

const DEFAULTS: PracticeOptions = { eachOnce: false };

let cached: PracticeOptions | null = null;
const listeners = new Set<() => void>();

export function getSnapshot(): PracticeOptions {
  if (typeof window === 'undefined') return DEFAULTS;
  if (cached === null) {
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PracticeOptions> | null;
      cached = { eachOnce: raw?.eachOnce === true };
    } catch {
      cached = DEFAULTS;
    }
  }
  return cached;
}
export const getServerSnapshot = () => DEFAULTS;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setEachOnce(eachOnce: boolean) {
  cached = { ...getSnapshot(), eachOnce };
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); } catch { /* Kept for this visit only. */ }
  listeners.forEach((listener) => listener());
}
