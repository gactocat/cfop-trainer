// While the timer is held or running without a smart cube, everything but
// the timer steps aside (the practice's title bar and options too), so the
// solver sees nothing else. Set by useHoldTimer, read where those parts are.

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
  listeners.forEach((listener) => listener());
}
