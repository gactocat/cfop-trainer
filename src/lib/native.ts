import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();
export const NATIVE_AUTH_REDIRECT = 'cfoptrainer://auth/callback';

interface NativeBridgePlugin {
  get({ key }: { key: string }): Promise<{ value: string | null }>;
  set({ key, value }: { key: string; value: string }): Promise<void>;
  remove({ key }: { key: string }): Promise<void>;
  keepAwake({ enabled }: { enabled: boolean }): Promise<void>;
}

export const NativeBridge = registerPlugin<NativeBridgePlugin>('NativeBridge');
export const nativeSessionStorage = {
  getItem: async (key: string) => (await NativeBridge.get({ key })).value,
  setItem: async (key: string, value: string) => { await NativeBridge.set({ key, value }); },
  removeItem: async (key: string) => { await NativeBridge.remove({ key }); },
};

export function authRedirectUrl() {
  return isNativeApp() ? NATIVE_AUTH_REDIRECT : `${window.location.origin}/account`;
}
