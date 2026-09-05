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

function readFromStorage(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : fromNavigator();
  } catch {
    return fromNavigator();
  }
}

function writeToStorage(locale: Locale): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

export function getSnapshot(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  if (cached === null) cached = readFromStorage();
  return cached;
}

// The server always renders English; the client switches right after
// hydration (see useMounted for why the two must differ this way).
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
  if (locale === getSnapshot()) return;
  cached = locale;
  writeToStorage(locale);
  listeners.forEach((l) => l());
}
