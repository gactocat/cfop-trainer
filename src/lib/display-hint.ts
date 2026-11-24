import { LOCALES, type Locale } from '@/i18n/messages';

// What the page looked like last on this device: the theme choice and the
// language. The settings themselves can live in the account (loaded over the
// network) or in the iOS app's storage (read asynchronously), so neither is
// available before the first paint. This copy is, in localStorage on the
// device only: the script in the root layout reads it before anything is
// drawn, and the theme and language fall back to it until the settings load.
// It is never synced and never read once the settings are known.
export const DISPLAY_HINT_KEY = 'cfop:display:v1';

export type ThemeChoice = 'light' | 'dark' | 'system';

export interface DisplayHint {
  theme?: ThemeChoice;
  locale?: Locale;
}

/** Set on <html> while the prerendered English must stay hidden; see globals.css. */
export const LOCALE_PENDING_ATTRIBUTE = 'data-locale-pending';

const isTheme = (value: unknown): value is ThemeChoice => value === 'light' || value === 'dark' || value === 'system';
const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

export function readDisplayHint(): DisplayHint {
  if (typeof window === 'undefined') return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(DISPLAY_HINT_KEY) ?? 'null') as Record<string, unknown> | null;
    if (typeof raw !== 'object' || raw === null) return {};
    return {
      ...(isTheme(raw.theme) ? { theme: raw.theme } : {}),
      ...(isLocale(raw.locale) ? { locale: raw.locale } : {}),
    };
  } catch {
    return {};
  }
}

export function writeDisplayHint(patch: DisplayHint): void {
  if (typeof window === 'undefined') return;
  const current = readDisplayHint();
  const next = { ...current, ...patch };
  if (next.theme === current.theme && next.locale === current.locale) return;
  try {
    window.localStorage.setItem(DISPLAY_HINT_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: the next load falls back to the system.
  }
}
