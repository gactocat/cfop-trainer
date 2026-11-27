// The smart cube connection: one GAN Gen4 cube, its battery and model, and the
// cube state tracked from its turns. Same store contract as the app's other
// stores; turns are also pushed to `subscribeTurns` listeners so a trainer can
// follow them one by one.
//
// The browser chooses the cube in its own dialog (Web Bluetooth). The iOS app
// has no such dialog: it scans with the Bluetooth plugin, lists the cubes found
// and connects the one picked, or the cube it connected last time.

import { isNativeApp } from '@/lib/native';
import { SOLVED, applyTurn, stateFromArrays, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { formatMac, parseMac, type GanCubeEvent } from '@/lib/smart-cube/gan-gen4';
import type { GanConnectionHandlers, GanGen4Connection, GanTrafficRecord } from '@/lib/smart-cube/gan-gen4-session';
import type { FoundCube } from '@/lib/smart-cube/gan-native-bluetooth';
import { connectGanGen4, requestGanCube, watchGanMac } from '@/lib/smart-cube/gan-web-bluetooth';
import { faceletsDecision } from '@/lib/smart-cube/state-sync';
import { smartCubeUnsupported, type SmartCubeUnsupported } from '@/lib/smart-cube/support';
import * as settings from '@/lib/smart-cube-settings-store';

export type { FoundCube };
export type SmartCubeStatus = 'idle' | 'choosing' | 'scanning' | 'reading-mac' | 'needs-mac' | 'connecting' | 'connected';
/** Why the last attempt or connection ended, for the settings panel. */
export type SmartCubeProblem =
  | 'not-gen4' | 'invalid-mac' | 'wrong-mac' | 'lost' | 'failed'
  // iOS app only.
  | 'none-found' | 'bluetooth-off' | 'bluetooth-denied';

export interface SmartCubeSnapshot {
  status: SmartCubeStatus;
  problem: SmartCubeProblem | null;
  deviceName: string | null;
  battery: number | null;
  model: string | null;
  firmware: string | null;
  /** Tracked cube state in the cube's own frame; null until the cube reports it. */
  state: CubeState | null;
  /** iOS app: cubes found by the last scan, to pick from. */
  found: readonly FoundCube[];
  /** Counts "mark as solved", so a guide in progress can start again from the new state. */
  calibration: number;
  /** The cube connected (or connecting) is the test cube, made in software (test-cube.ts). */
  virtual: boolean;
}

export interface SmartCubeTurn {
  face: Face;
  /** 1 clockwise, 3 counter-clockwise: the cube reports quarter turns. */
  amount: 1 | 3;
  /** Cube clock, ms. */
  cubeTime: number;
  /** Host clock (performance.now()) when the turn arrived. */
  hostTime: number;
  /** State after the turn. */
  state: CubeState;
}

const INITIAL: SmartCubeSnapshot = {
  status: 'idle', problem: null, deviceName: null, battery: null, model: null, firmware: null, state: null, found: [],
  calibration: 0, virtual: false,
};
/** No notification for this long means the link is gone (the cube streams gyro data about 10 times a second). */
const SILENCE_MS = 3000;
/** How long the iOS app scans before it stops by itself. */
const SCAN_MS = 15000;
/** After "mark as solved", how long only the cube's solved report counts (an older one may still be on its way). */
const RESET_CONFIRM_MS = 2000;

/** The cube picked in the browser dialog or from the app's scan, ready to connect. */
interface ChosenCube {
  name: string | null;
  /** iOS app: CoreBluetooth's identifier, remembered once the connection works. */
  nativeId: string | null;
  /** iOS app: the MAC read from the scan, if any. */
  scannedMac: string | null;
  /** The test cube rather than a cube over Bluetooth. */
  virtual?: boolean;
  open(mac: string, handlers: GanConnectionHandlers): Promise<GanGen4Connection>;
}

let snapshot = INITIAL;
const listeners = new Set<() => void>();
const turnListeners = new Set<(turn: SmartCubeTurn) => void>();
let chosen: ChosenCube | null = null;
let connection: GanGen4Connection | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let lastNotification = 0;
let valid = 0;
let invalid = 0;
let confirmed = false;
let pendingMac: string | null = null;
let endReason: SmartCubeProblem | 'user' | null = null;
let lastMoveSerial: number | null = null;
// Cube clock minus host clock, for turns recovered from the cube's history.
let clockOffset: number | null = null;
// Until then (performance.now()), FACELETS reports wait for the cube to confirm a reset.
let resetUntil = 0;

function update(patch: Partial<SmartCubeSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => INITIAL;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function subscribeTurns(listener: (turn: SmartCubeTurn) => void) {
  turnListeners.add(listener);
  return () => { turnListeners.delete(listener); };
}

/** Why a smart cube cannot be used here, or null when it can. */
export function unsupportedReason(): SmartCubeUnsupported | null {
  if (typeof window === 'undefined') return 'browser';
  return smartCubeUnsupported({
    hasBluetooth: 'bluetooth' in navigator,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    nativeApp: isNativeApp(),
  });
}

export const hasChosenDevice = () => chosen !== null;

type NativeTransport = typeof import('@/lib/smart-cube/gan-native-bluetooth');
let nativeTransport: Promise<NativeTransport> | null = null;
// Only the app loads the plugin, so the web bundle does not grow.
const loadNative = () => (nativeTransport ??= import('@/lib/smart-cube/gan-native-bluetooth'));

function problemOf(error: unknown): SmartCubeProblem {
  const problem = (error as { problem?: unknown } | null)?.problem;
  if (problem === 'bluetooth-off' || problem === 'bluetooth-denied') return problem;
  const message = error instanceof Error ? error.message : '';
  return message.includes('Gen4') ? 'not-gen4' : 'failed';
}

function onEvent(event: GanCubeEvent) {
  switch (event.type) {
    case 'HARDWARE':
      update({ model: event.hardwareName ?? null, firmware: event.softwareVersion ?? null });
      // A readable model name proves the MAC decrypts the data; remember it.
      if (!confirmed && event.hardwareName?.startsWith('GAN') && chosen?.name && pendingMac) {
        confirmed = true;
        settings.rememberMac(chosen.name, pendingMac);
        if (chosen.nativeId) settings.rememberLastCube(chosen.nativeId, chosen.name);
      }
      break;
    case 'BATTERY':
      update({ battery: event.batteryLevel });
      break;
    case 'FACELETS': {
      // The cube's own state, reported on request and about once a second.
      // Resync to it only when no turn is in flight (the turns applied are
      // newer) and not while a reset is being confirmed (see markSolved).
      const state = stateFromArrays(event.state.CP, event.state.CO, event.state.EP, event.state.EO);
      if (!state) break;
      const decision = faceletsDecision({
        reported: state, serial: event.serial, lastMoveSerial, confirmingReset: performance.now() < resetUntil,
      });
      if (decision === 'skip') break;
      if (decision === 'confirm-reset') {
        // Solved, plus any turn made since the button, is already the state here.
        resetUntil = 0;
        lastMoveSerial ??= event.serial;
        break;
      }
      lastMoveSerial = event.serial;
      update({ state });
      break;
    }
    case 'MOVE': {
      const current = snapshot.state;
      lastMoveSerial = event.serial;
      if (!current) break;
      const face = 'URFDLB'[event.face] as Face;
      const amount = event.direction ? 3 : 1;
      const state = applyTurn(current, face, amount);
      if (event.cubeTimestamp !== null && event.localTimestamp !== null) clockOffset = event.cubeTimestamp - event.localTimestamp;
      const cubeTime = event.cubeTimestamp ?? event.timestamp + (clockOffset ?? 0);
      update({ state });
      const turn: SmartCubeTurn = { face, amount, cubeTime, hostTime: event.localTimestamp ?? event.timestamp, state };
      turnListeners.forEach((l) => l(turn));
      break;
    }
  }
}

function onTraffic(record: GanTrafficRecord) {
  if (record.op !== 'notify') return;
  lastNotification = performance.now();
  if (record.valid) valid++;
  else invalid++;
  // Noise from a wrong MAC fails the packet check most of the time.
  if (!confirmed && valid + invalid >= 20 && valid < (valid + invalid) / 2) {
    endReason = 'wrong-mac';
    if (chosen?.name) settings.forgetMac(chosen.name);
    connection?.disconnect();
  }
}

function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

function onDisconnect() {
  connection = null;
  stopHeartbeat();
  const reason = endReason;
  endReason = null;
  lastMoveSerial = null;
  resetUntil = 0;
  // The test cube is not offered again as the cube to reconnect.
  if (snapshot.virtual) chosen = null;
  update({
    status: reason === 'wrong-mac' ? 'needs-mac' : 'idle',
    problem: reason === 'user' ? null : reason ?? 'lost',
    state: null,
    virtual: false,
  });
}

async function connectWith(mac: string) {
  const cube = chosen;
  if (!cube) return;
  update({ status: 'connecting', problem: null, deviceName: cube.name, virtual: cube.virtual ?? false });
  pendingMac = mac;
  confirmed = false;
  valid = 0;
  invalid = 0;
  endReason = null;
  lastMoveSerial = null;
  clockOffset = null;
  try {
    connection = await cube.open(mac, { onEvent, onTraffic, onDisconnect });
  } catch (error) {
    update({ status: 'idle', problem: problemOf(error) });
    return;
  }
  lastNotification = performance.now();
  heartbeat = setInterval(() => {
    // A hidden page (the app in the background) runs no timers and may get
    // notifications late; it is not silence.
    if (document.hidden) lastNotification = performance.now();
    if (connection && performance.now() - lastNotification > SILENCE_MS) {
      endReason = 'lost';
      connection.disconnect();
    }
  }, 1000);
  update({ status: 'connected', battery: null, model: null, firmware: null, state: null, found: [] });
  // Turns count only after the cube has reported its state, so ask for it first.
  for (const type of ['REQUEST_FACELETS', 'REQUEST_HARDWARE', 'REQUEST_BATTERY'] as const) {
    await connection?.sendCommand({ type }).catch(() => {});
  }
}

/** The MAC to use without asking: typed, remembered for the cube, or read from its scan. */
function knownMac(typedMac: string): string | null {
  const typed = parseMac(typedMac);
  if (typed) return formatMac(typed);
  const saved = chosen?.name ? settings.getSnapshot().macs[chosen.name] : undefined;
  if (saved && parseMac(saved)) return saved;
  return chosen?.scannedMac ?? null;
}

/**
 * Choose a cube and connect: in the browser, in its dialog (must run from a
 * click); in the iOS app, by starting a scan to pick from. The MAC comes from
 * `typedMac`, then the one remembered for the cube, then the cube's
 * advertisements; otherwise the status becomes `needs-mac`.
 */
export async function connect(typedMac = '') {
  dropTestCube();
  if (connection || unsupportedReason()) return;
  if (isNativeApp()) return startScan();
  update({ status: 'choosing', problem: null });
  let device: BluetoothDevice;
  try {
    // First await in the handler, so the click still counts as the user's gesture.
    device = await requestGanCube();
  } catch {
    // Closing the dialog without choosing ends up here too; nothing to report.
    update({ status: 'idle' });
    return;
  }
  chosen = {
    name: device.name ?? null,
    nativeId: null,
    scannedMac: null,
    open: (mac, handlers) => connectGanGen4(device, mac, handlers),
  };
  update({ deviceName: chosen.name });
  const known = knownMac(typedMac);
  if (known) return connectWith(known);
  update({ status: 'reading-mac' });
  const fromAdvertisement = await watchGanMac(device);
  if (fromAdvertisement) return connectWith(fromAdvertisement);
  update({ status: 'needs-mac' });
}

/** Connect the cube already chosen, with a typed MAC (or the remembered one when empty). */
export async function connectChosen(typedMac = '') {
  dropTestCube();
  if (connection || !chosen) return;
  if (typedMac.trim() && !parseMac(typedMac)) {
    update({ status: 'needs-mac', problem: 'invalid-mac' });
    return;
  }
  const known = knownMac(typedMac);
  if (known) return connectWith(known);
  // Nothing typed and nothing remembered is a request for the MAC, not an error.
  update({ status: 'needs-mac', problem: null });
}

export function disconnect() {
  if (!connection) return;
  endReason = 'user';
  connection.disconnect();
}

// One cube at a time: a real one replaces the test cube.
function dropTestCube() {
  if (snapshot.virtual) disconnect();
}

/**
 * Connect a cube made in software (the test cube, see test-cube.ts) in place
 * of any cube connected. From here on it is handled like a real one.
 */
export async function connectVirtual(name: string, mac: string, open: (handlers: GanConnectionHandlers) => GanGen4Connection) {
  disconnect();
  if (snapshot.status === 'scanning') await stopScan();
  chosen = { name, nativeId: null, scannedMac: mac, virtual: true, open: async (_mac, handlers) => open(handlers) };
  await connectWith(mac);
}

/**
 * The cube in hand is solved: reset the state the cube keeps (it reports that
 * state about once a second, so resetting only the one tracked here would be
 * undone), take solved here at once, and ask the cube to confirm. Until it
 * does, for RESET_CONFIRM_MS, an older report cannot bring the old state back.
 * False when the cube could not be reached.
 */
export async function markSolved(): Promise<boolean> {
  const link = connection;
  if (!link || snapshot.status !== 'connected') return false;
  try {
    await link.sendCommand({ type: 'REQUEST_RESET' });
  } catch {
    return false;
  }
  if (connection !== link) return false;
  resetUntil = performance.now() + RESET_CONFIRM_MS;
  // The cube may count its turns afresh after a reset: the next report sets the baseline.
  lastMoveSerial = null;
  update({ state: SOLVED, calibration: snapshot.calibration + 1 });
  void link.sendCommand({ type: 'REQUEST_FACELETS' }).catch(() => {});
  return true;
}

// --- iOS app: scan, pick, reconnect

let stopScanning: (() => Promise<void>) | null = null;
let scanTimer: ReturnType<typeof setTimeout> | null = null;

function nativeCube(id: string, name: string, scannedMac: string | null): ChosenCube {
  return {
    name,
    nativeId: id,
    scannedMac,
    open: async (mac, handlers) => (await loadNative()).connectNativeGanGen4({ deviceId: id, name }, mac, handlers),
  };
}

/** Scan for GAN cubes nearby; they appear in `found` as they advertise. Stops by itself. */
export async function startScan() {
  dropTestCube();
  if (connection || snapshot.status === 'scanning' || snapshot.status === 'connecting') return;
  update({ status: 'scanning', problem: null, found: [] });
  const found = new Map<string, FoundCube>();
  try {
    const stop = await (await loadNative()).scanGanCubes((cube) => {
      if (snapshot.status !== 'scanning') return;
      const before = found.get(cube.deviceId);
      const mac = cube.mac ?? before?.mac ?? null;
      // The same cube advertises many times a second; update only on news.
      if (before && before.name === cube.name && before.mac === mac) return;
      found.set(cube.deviceId, { ...cube, mac });
      update({ found: [...found.values()] });
    });
    // Read afresh: the status may have changed while the scan was starting.
    if (getSnapshot().status !== 'scanning') {
      // Stopped (or a cube picked) while the scan was starting.
      await stop();
      return;
    }
    stopScanning = stop;
    scanTimer = setTimeout(() => void stopScan(), SCAN_MS);
  } catch (error) {
    update({ status: 'idle', problem: problemOf(error) });
  }
}

/** Stop scanning, keeping the cubes found so far. Safe to call when not scanning. */
export async function stopScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = null;
  const stop = stopScanning;
  stopScanning = null;
  if (snapshot.status === 'scanning') update({ status: 'idle', problem: snapshot.found.length > 0 ? null : 'none-found' });
  await stop?.();
}

/** Connect a cube from `found`. */
export async function connectFound(deviceId: string, typedMac = '') {
  dropTestCube();
  const cube = snapshot.found.find((c) => c.deviceId === deviceId);
  if (!cube || connection || snapshot.status === 'connecting') return;
  await stopScan();
  chosen = nativeCube(cube.deviceId, cube.name, cube.mac);
  update({ deviceName: cube.name, problem: null });
  const known = knownMac(typedMac);
  if (known) return connectWith(known);
  update({ status: 'needs-mac' });
}

/**
 * Connect the cube connected last time without scanning. Falls back to a scan
 * when iOS no longer knows it or no MAC is remembered for it.
 */
export async function connectLast(typedMac = '') {
  dropTestCube();
  const last = settings.getSnapshot().lastCube;
  if (!last || connection || snapshot.status === 'connecting' || snapshot.status === 'scanning') return;
  update({ status: 'connecting', problem: null, deviceName: last.name });
  let known: boolean;
  try {
    known = await (await loadNative()).isKnownCube(last.id);
  } catch (error) {
    update({ status: 'idle', problem: problemOf(error) });
    return;
  }
  chosen = nativeCube(last.id, last.name, null);
  const mac = knownMac(typedMac);
  if (!known || !mac) {
    update({ status: 'idle' });
    return startScan();
  }
  return connectWith(mac);
}

/**
 * iOS app, at start: disconnect cubes the Bluetooth plugin still holds for an
 * earlier load of the page (see releaseLeftoverCubes in gan-native-bluetooth).
 * Leaves this page's own cube alone.
 */
export async function releaseLeftoverCubes() {
  if (!isNativeApp() || connection || snapshot.status !== 'idle') return;
  await (await loadNative()).releaseLeftoverCubes().catch(() => 0);
}

/** Open the app's page in iOS Settings, to allow Bluetooth after declining. */
export async function openBluetoothSettings() {
  await (await loadNative()).openAppSettings().catch(() => {});
}
