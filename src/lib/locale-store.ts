import { canWriteData, getPersistenceSnapshot, readStoredValue, subscribeData, writeStoredValue } from '@/lib/persistence';
import { readDisplayHint } from '@/lib/display-hint';
import { LOCALES, type Locale } from '@/i18n/messages';

// UI language. Defaults to the browser language on first visit (Japanese
// browsers get Japanese, everything else English) and is then persisted.
const STORAGE_KEY = 'pll-app:locale:v1';
const DEFAULT_LOCALE: Locale = 'en';

let cached: Locale | null = null;
const listeners = new Set<() => void>();

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function fromNavigator(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : DEFAULT_LOCALE;
}

// Until the settings are loaded (account sign-in, the iOS app's storage),
// the language last shown on this device stands in for the stored one, so
// the page does not switch to the browser language and back.
function fallback(): Locale {
  const { mode } = getPersistenceSnapshot();
  if (mode !== 'guest' && mode !== 'account') {
    const { locale } = readDisplayHint();
    if (locale) return locale;
  }
  return fromNavigator();
}

function readFromStorage(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = readStoredValue(STORAGE_KEY);
    return isLocale(raw) ? raw : fallback();
  } catch {
    return fallback();
  }
}

function writeToStorage(locale: Locale): void {
  if (typeof window === 'undefined') return;
  writeStoredValue(STORAGE_KEY, locale);
}

export function getSnapshot(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  if (cached === null) cached = readFromStorage();
  return cached;
}

// The server always renders English; the client switches right after
// hydration (see useMounted for why the two must differ this way). For
// another language, the head script keeps that English hidden until then
// (display-init-script.ts).
export function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocale(locale: Locale): void {
  if (!canWriteData() || locale === getSnapshot()) return;
  writeToStorage(locale);
  cached = locale;
  listeners.forEach((l) => l());
}

subscribeData(() => {
  cached = null;
  listeners.forEach((listener) => listener());
});
