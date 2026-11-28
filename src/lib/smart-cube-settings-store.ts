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
   * No-scramble chosen as a third random-training mode (versions before the
   * two modes). It now reads as no setup (`practiceModeFrom`) and is cleared
   * when a mode is chosen; with no setup, a connected cube gives no-scramble.
   */
  noScramble: boolean;
  /** No-scramble: show the next case by itself once the cube has been still; otherwise Next does. */
  autoAdvance: boolean;
  /**
   * The cube last connected in the iOS app, so it can connect again without a
   * scan. `id` is CoreBluetooth's identifier, which only this installation knows.
   */
  lastCube: Readonly<{ id: string; name: string }> | null;
}

const DEFAULTS: SmartCubeSettings = { holding: DEFAULT_HOLDING, macs: {}, noScramble: false, autoAdvance: false, lastCube: null };

function decode(raw: unknown): SmartCubeSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULTS;
  const value = raw as Partial<SmartCubeSettings>;
  const macs: Record<string, string> = {};
  if (typeof value.macs === 'object' && value.macs !== null) {
    for (const [name, mac] of Object.entries(value.macs)) if (typeof mac === 'string') macs[name] = mac;
  }
  const last = value.lastCube as { id?: unknown; name?: unknown } | null | undefined;
  return {
    holding: CUBE_HOLDINGS.includes(value.holding as CubeHolding) ? (value.holding as CubeHolding) : DEFAULT_HOLDING,
    macs,
    noScramble: value.noScramble === true,
    autoAdvance: value.autoAdvance === true,
    lastCube: typeof last?.id === 'string' && typeof last.name === 'string' ? { id: last.id, name: last.name } : null,
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
  if (getSnapshot().holding === holding) return;
  write({ ...getSnapshot(), holding });
}

export function setNoScramble(noScramble: boolean) {
  if (getSnapshot().noScramble === noScramble) return;
  write({ ...getSnapshot(), noScramble });
}

export function setAutoAdvance(autoAdvance: boolean) {
  if (getSnapshot().autoAdvance === autoAdvance) return;
  write({ ...getSnapshot(), autoAdvance });
}

export function rememberMac(deviceName: string, mac: string) {
  const current = getSnapshot();
  if (current.macs[deviceName] === mac) return;
  write({ ...current, macs: { ...current.macs, [deviceName]: mac } });
}

export function rememberLastCube(id: string, name: string) {
  const current = getSnapshot();
  if (current.lastCube?.id === id && current.lastCube.name === name) return;
  write({ ...current, lastCube: { id, name } });
}

export function forgetLastCube() {
  if (getSnapshot().lastCube === null) return;
  write({ ...getSnapshot(), lastCube: null });
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
