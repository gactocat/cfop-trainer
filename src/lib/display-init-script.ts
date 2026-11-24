import { DISPLAY_HINT_KEY, LOCALE_PENDING_ATTRIBUTE } from '@/lib/display-hint';

// Guest settings as the browser keeps them (practice-settings-store and
// locale-store), read only when no hint has been written yet, i.e. on the
// first load after this script shipped.
const GUEST_SETTINGS_KEY = 'pll-app:practice-settings:v1';
const GUEST_LOCALE_KEY = 'pll-app:locale:v1';

/**
 * Runs in <head> before the first paint (the pages are prerendered, in
 * English and without a theme). Sets <html data-theme> from the theme last
 * shown on this device, else the guest setting, else the system; sets
 * <html lang> the same way, falling back to the browser language like the
 * locale store. When the language is not English, the prerendered text is
 * hidden until the client has rendered it in the right language (HtmlLang
 * removes the attribute), with a timeout so a failed script never leaves the
 * page blank.
 */
export const DISPLAY_INIT_SCRIPT = `(function () {
  var d = document.documentElement;
  try {
    var hint = {};
    try { hint = JSON.parse(localStorage.getItem(${JSON.stringify(DISPLAY_HINT_KEY)}) || '{}') || {}; } catch (e) {}
    var theme = hint.theme;
    if (!theme) { try { theme = (JSON.parse(localStorage.getItem(${JSON.stringify(GUEST_SETTINGS_KEY)}) || '{}') || {}).colorTheme; } catch (e) {} }
    var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    d.setAttribute('data-theme', dark ? 'dark' : 'light');
    var locale = hint.locale;
    if (locale !== 'ja' && locale !== 'en') { try { locale = localStorage.getItem(${JSON.stringify(GUEST_LOCALE_KEY)}); } catch (e) {} }
    if (locale !== 'ja' && locale !== 'en') locale = (navigator.language || '').toLowerCase().indexOf('ja') === 0 ? 'ja' : 'en';
    d.lang = locale;
    if (locale !== 'en') {
      d.setAttribute(${JSON.stringify(LOCALE_PENDING_ATTRIBUTE)}, '');
      setTimeout(function () { d.removeAttribute(${JSON.stringify(LOCALE_PENDING_ATTRIBUTE)}); }, 3000);
    }
  } catch (e) {
    d.removeAttribute(${JSON.stringify(LOCALE_PENDING_ATTRIBUTE)});
  }
})();`;
