type AppDialog = 'settings' | 'account' | null;
let current: AppDialog = null;
const listeners = new Set<() => void>();

export const getAppDialog = () => current;
export const getAppDialogServerSnapshot = () => null;
export function subscribeAppDialog(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function openAppDialog(dialog: AppDialog) {
  current = dialog;
  listeners.forEach((listener) => listener());
}
export const openAccountDialog = () => openAppDialog('account');
export const closeAppDialog = () => openAppDialog(null);
