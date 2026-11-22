// The smart cube connection: one GAN Gen4 cube over Web Bluetooth, its battery
// and model, and the cube state tracked from its turns. Same store contract as
// the app's other stores; turns are also pushed to `subscribeTurns` listeners
// so a trainer can follow them one by one.

import { isNativeApp } from '@/lib/native';
import { applyTurn, stateFromArrays, type Amount, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { formatMac, parseMac, type GanCubeEvent } from '@/lib/smart-cube/gan-gen4';
import {
  connectGanGen4,
  requestGanCube,
  watchGanMac,
  type GanGen4Connection,
  type GanTrafficRecord,
} from '@/lib/smart-cube/gan-web-bluetooth';
import { smartCubeUnsupported, type SmartCubeUnsupported } from '@/lib/smart-cube/support';
import * as settings from '@/lib/smart-cube-settings-store';

export type SmartCubeStatus = 'idle' | 'choosing' | 'reading-mac' | 'needs-mac' | 'connecting' | 'connected';
/** Why the last attempt or connection ended, for the settings panel. */
export type SmartCubeProblem = 'not-gen4' | 'invalid-mac' | 'wrong-mac' | 'lost' | 'failed';

export interface SmartCubeSnapshot {
  status: SmartCubeStatus;
  problem: SmartCubeProblem | null;
  deviceName: string | null;
  battery: number | null;
  model: string | null;
  firmware: string | null;
  /** Tracked cube state in the cube's own frame; null until the cube reports it. */
  state: CubeState | null;
}

export interface SmartCubeTurn {
  face: Face;
  amount: Amount;
  /** Cube clock, ms. */
  cubeTime: number;
  /** State after the turn. */
  state: CubeState;
}

const INITIAL: SmartCubeSnapshot = {
  status: 'idle', problem: null, deviceName: null, battery: null, model: null, firmware: null, state: null,
};
/** No notification for this long means the link is gone (the cube streams gyro data about 10 times a second). */
const SILENCE_MS = 3000;

let snapshot = INITIAL;
const listeners = new Set<() => void>();
const turnListeners = new Set<(turn: SmartCubeTurn) => void>();
let device: BluetoothDevice | null = null;
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

export const hasChosenDevice = () => device !== null;

function onEvent(event: GanCubeEvent) {
  switch (event.type) {
    case 'HARDWARE':
      update({ model: event.hardwareName ?? null, firmware: event.softwareVersion ?? null });
      // A readable model name proves the MAC decrypts the data; remember it.
      if (!confirmed && event.hardwareName?.startsWith('GAN') && device?.name && pendingMac) {
        confirmed = true;
        settings.rememberMac(device.name, pendingMac);
      }
      break;
    case 'BATTERY':
      update({ battery: event.batteryLevel });
      break;
    case 'FACELETS': {
      // Resync only when no turn is in flight; otherwise the turns already applied are newer.
      if (lastMoveSerial !== null && event.serial !== lastMoveSerial) break;
      const state = stateFromArrays(event.state.CP, event.state.CO, event.state.EP, event.state.EO);
      if (state) {
        lastMoveSerial = event.serial;
        update({ state });
      }
      break;
    }
    case 'MOVE': {
      const current = snapshot.state;
      lastMoveSerial = event.serial;
      if (!current) break;
      const face = 'URFDLB'[event.face] as Face;
      const amount: Amount = event.direction ? 3 : 1;
      const state = applyTurn(current, face, amount);
      if (event.cubeTimestamp !== null && event.localTimestamp !== null) clockOffset = event.cubeTimestamp - event.localTimestamp;
      const cubeTime = event.cubeTimestamp ?? event.timestamp + (clockOffset ?? 0);
      update({ state });
      const turn: SmartCubeTurn = { face, amount, cubeTime, state };
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
    if (device?.name) settings.forgetMac(device.name);
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
  update({
    status: reason === 'wrong-mac' ? 'needs-mac' : 'idle',
    problem: reason === 'user' ? null : reason ?? 'lost',
    state: null,
  });
}

async function connectWith(mac: string) {
  if (!device) return;
  update({ status: 'connecting', problem: null, deviceName: device.name ?? null });
  pendingMac = mac;
  confirmed = false;
  valid = 0;
  invalid = 0;
  endReason = null;
  lastMoveSerial = null;
  clockOffset = null;
  try {
    connection = await connectGanGen4(device, mac, { onEvent, onTraffic, onDisconnect });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    update({ status: 'idle', problem: message.includes('Gen4') ? 'not-gen4' : 'failed' });
    return;
  }
  lastNotification = performance.now();
  heartbeat = setInterval(() => {
    if (connection && performance.now() - lastNotification > SILENCE_MS) {
      endReason = 'lost';
      connection.disconnect();
    }
  }, 1000);
  update({ status: 'connected', battery: null, model: null, firmware: null, state: null });
  // Turns count only after the cube has reported its state, so ask for it first.
  for (const type of ['REQUEST_FACELETS', 'REQUEST_HARDWARE', 'REQUEST_BATTERY'] as const) {
    await connection?.sendCommand({ type }).catch(() => {});
  }
}

/**
 * Choose a cube in the browser's dialog and connect. Must run from a click.
 * The MAC comes from `typedMac`, then the one remembered for the cube, then
 * the cube's advertisements; otherwise the status becomes `needs-mac`.
 */
export async function connect(typedMac = '') {
  if (connection || unsupportedReason()) return;
  update({ status: 'choosing', problem: null });
  try {
    // First await in the handler, so the click still counts as the user's gesture.
    device = await requestGanCube();
  } catch {
    // Closing the dialog without choosing ends up here too; nothing to report.
    update({ status: 'idle' });
    return;
  }
  update({ deviceName: device.name ?? null });
  const typed = parseMac(typedMac);
  if (typed) return connectWith(formatMac(typed));
  const saved = device.name ? settings.getSnapshot().macs[device.name] : undefined;
  if (saved && parseMac(saved)) return connectWith(saved);
  update({ status: 'reading-mac' });
  const fromAdvertisement = await watchGanMac(device);
  if (fromAdvertisement) return connectWith(fromAdvertisement);
  update({ status: 'needs-mac' });
}

/** Connect the cube already chosen, with a typed MAC (or the remembered one when empty). */
export async function connectChosen(typedMac = '') {
  if (connection || !device) return;
  const typed = parseMac(typedMac);
  if (typed) return connectWith(formatMac(typed));
  const saved = device.name ? settings.getSnapshot().macs[device.name] : undefined;
  if (!typedMac.trim() && saved && parseMac(saved)) return connectWith(saved);
  update({ status: 'needs-mac', problem: 'invalid-mac' });
}

export function disconnect() {
  if (!connection) return;
  endReason = 'user';
  connection.disconnect();
}
