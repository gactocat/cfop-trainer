import { CUBE_HOLDINGS, DEFAULT_HOLDING, type CubeHolding } from '@/lib/smart-cube/holding';

// Smart cube preferences belong to this device (which cube is near, how it is
// held), so they live in localStorage directly instead of going through the
// persistence layer: guests and accounts alike keep them on the device, and
// they never enter the account document.
const STORAGE_KEY = 'cfop:smart-cube:v1';

export interface SmartCubeSettings {
  holding: CubeHolding;
  /** MAC address per advertised device name, remembered after a successful connection. */
  macs: Readonly<Record<string, string>>;
  /**
   * Random training in no-scramble mode. Kept here, on the device, rather than
   * in the synced trainer mode: it needs this device's smart cube, and older
   * app versions only know standard and inverse.
   */
  noScramble: boolean;
}

const DEFAULTS: SmartCubeSettings = { holding: DEFAULT_HOLDING, macs: {}, noScramble: false };

function decode(raw: unknown): SmartCubeSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULTS;
  const value = raw as Partial<SmartCubeSettings>;
  const macs: Record<string, string> = {};
  if (typeof value.macs === 'object' && value.macs !== null) {
    for (const [name, mac] of Object.entries(value.macs)) if (typeof mac === 'string') macs[name] = mac;
  }
  return {
    holding: CUBE_HOLDINGS.includes(value.holding as CubeHolding) ? (value.holding as CubeHolding) : DEFAULT_HOLDING,
    macs,
    noScramble: value.noScramble === true,
  };
}

let cached: SmartCubeSettings | null = null;
const listeners = new Set<() => void>();

export function getSnapshot(): SmartCubeSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  if (cached === null) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      cached = raw === null ? DEFAULTS : decode(JSON.parse(raw));
    } catch {
      cached = DEFAULTS;
    }
  }
  return cached;
}

export const getServerSnapshot = () => DEFAULTS;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function write(next: SmartCubeSettings) {
  cached = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: keep the value for this page only.
  }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    cached = null;
    listeners.forEach((l) => l());
  });
}

export function setHolding(holding: CubeHolding) {
  write({ ...getSnapshot(), holding });
}

export function setNoScramble(noScramble: boolean) {
  if (getSnapshot().noScramble === noScramble) return;
  write({ ...getSnapshot(), noScramble });
}

export function rememberMac(deviceName: string, mac: string) {
  const current = getSnapshot();
  if (current.macs[deviceName] === mac) return;
  write({ ...current, macs: { ...current.macs, [deviceName]: mac } });
}

/** Forget one device's MAC, or every remembered MAC. */
export function forgetMac(deviceName?: string) {
  const current = getSnapshot();
  if (deviceName === undefined) {
    write({ ...current, macs: {} });
    return;
  }
  const macs = { ...current.macs };
  delete macs[deviceName];
  write({ ...current, macs });
}
