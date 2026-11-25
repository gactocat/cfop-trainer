// While the timer is held or running, everything but the timer steps aside
// (the practice's title bar and options too, and the app's header and
// footer through an attribute on <html>), so the solver sees nothing else.
// Set by useHoldTimer and the smart cube solve, read where those parts are.

let focused = false;
const listeners = new Set<() => void>();

export const getTimerFocus = () => focused;
export const getTimerFocusServerSnapshot = () => false;
export function subscribeTimerFocus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setTimerFocus(value: boolean) {
  if (value === focused) return;
  focused = value;
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-timer-focus', value);
  listeners.forEach((listener) => listener());
}
