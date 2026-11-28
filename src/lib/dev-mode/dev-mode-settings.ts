// Developer mode on or off, kept on this device only (as the smart cube's
// settings are): it never enters the account document, whose keys the
// database checks. It matters only while a developer is signed in.
const STORAGE_KEY = 'cfop:dev-mode:v1';

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return typeof value === 'object' && value !== null && (value as { enabled?: unknown }).enabled === true;
  } catch {
    return false;
  }
}

export function getDevModeSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  cached ??= read();
  return cached;
}
export const getDevModeServerSnapshot = () => false;

export function subscribeDevMode(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cached = null;
  listeners.forEach((listener) => listener());
}

export function setDevModeEnabled(enabled: boolean) {
  cached = enabled;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled })); } catch { /* kept for this page */ }
  listeners.forEach((listener) => listener());
}
