import { DATA_KEYS, parseAccountData } from '@/lib/account-data';
import { isNativeApp } from '@/lib/native';

const values = new Map<string, string>();
const DOCUMENT_KEY = 'cfop:guest:v1';
let ready = false;
let writes: Promise<void> = Promise.resolve();

export async function initializeGuestStorage() {
  if (!isNativeApp() || ready) return;
  const { Preferences } = await import('@capacitor/preferences');
  const document = await Preferences.get({ key: DOCUMENT_KEY });
  if (document.value !== null) {
    for (const [key, value] of Object.entries(parseAccountData(JSON.parse(document.value)))) values.set(key, value);
    ready = true;
    return;
  }
  const entries = await Promise.all(DATA_KEYS.map(async (key) => {
    const { value } = await Preferences.get({ key });
    // Preserve records from earlier WebView-only versions, if present.
    const stored = value ?? window.localStorage.getItem(key);
    if (value === null && stored !== null) await Preferences.set({ key, value: stored });
    return [key, stored] as const;
  }));
  for (const [key, value] of entries) if (value !== null) values.set(key, value);
  await Preferences.set({ key: DOCUMENT_KEY, value: JSON.stringify(Object.fromEntries(values)) });
  ready = true;
}

export function readGuestValue(key: string) {
  if (!isNativeApp()) return window.localStorage.getItem(key);
  if (!ready) throw new Error('Guest storage is not ready');
  return values.get(key) ?? null;
}

export function writeGuestValue(key: string, value: string): void | Promise<void> {
  if (!isNativeApp()) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (!ready) throw new Error('Guest storage is not ready');
  values.set(key, value);
  const document = JSON.stringify(Object.fromEntries(values));
  const next = writes.then(async () => {
    const { Preferences } = await import('@capacitor/preferences');
    // Each write contains the entire guest snapshot, so a later successful
    // write also repairs any earlier failed write to a different key.
    await Preferences.set({ key: DOCUMENT_KEY, value: document });
  });
  writes = next.catch(() => {});
  return next;
}
