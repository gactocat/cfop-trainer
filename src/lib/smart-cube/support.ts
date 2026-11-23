// Whether this environment can connect a smart cube, and if not, why. The iOS
// app connects through its Bluetooth plugin; browsers need Web Bluetooth.
// Pure so it can be tested with sample user agents.

export type SmartCubeUnsupported = 'ios' | 'insecure' | 'firefox' | 'safari' | 'browser';

export interface SupportEnvironment {
  hasBluetooth: boolean;
  secureContext: boolean;
  userAgent: string;
  maxTouchPoints: number;
  nativeApp: boolean;
}

export function smartCubeUnsupported(env: SupportEnvironment): SmartCubeUnsupported | null {
  // The iOS app's WebView has no Web Bluetooth, but the app has a native transport.
  if (env.nativeApp) return null;
  // Some iOS browsers (Bluefy) add Web Bluetooth themselves, so check it first.
  if (env.hasBluetooth) return env.secureContext ? null : 'insecure';
  const ua = env.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1)) return 'ios';
  if (!env.secureContext) return 'insecure';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) return 'safari';
  return 'browser';
}
