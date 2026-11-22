// State of the /dev/gan-i4 spike: one cube connection, everything it reports,
// and a log that can be saved as JSON. Kept outside React and read through
// useSyncExternalStore, like the app's stores.

import {
  connectGanGen4,
  requestGanCube,
  watchGanMac,
  webBluetoothSupport,
  type GanGen4Connection,
  type GanTrafficRecord,
} from '@/lib/smart-cube/gan-web-bluetooth';
import { parseMac, formatMac, type GanCubeCommand, type GanCubeEvent, type GanGen4Stats } from '@/lib/smart-cube/gan-gen4';

export type SpikeStatus =
  | 'idle'
  | 'choosing'
  | 'reading-mac'
  | 'needs-mac'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface MoveRow {
  index: number;
  serial: number;
  move: string;
  /** Cube clock, ms. Null when recovered from history. */
  cubeTimestamp: number | null;
  /** performance.now() at arrival, ms. Null when recovered from history. */
  localTimestamp: number | null;
  /** The serial does not follow the previous delivered move. */
  serialGap: boolean;
}

export interface Marker {
  t: number;
  label: string;
  /** Index of the first move after the marker. */
  moveIndex: number;
}

export interface SpikeSnapshot {
  status: SpikeStatus;
  message: string | null;
  deviceName: string | null;
  mac: string | null;
  macSource: 'typed' | 'saved' | 'advertisement' | null;
  connectedAt: number | null;
  connections: number;
  disconnects: { t: number; reason: string; connectedMs: number | null }[];
  battery: { level: number; t: number } | null;
  hardware: Extract<GanCubeEvent, { type: 'HARDWARE' }> | null;
  facelets: { facelets: string; serial: number; t: number } | null;
  faceletsCount: number;
  gyro: Extract<GanCubeEvent, { type: 'GYRO' }> | null;
  gyroCount: number;
  gyroHz: number;
  moves: MoveRow[];
  serialGaps: number;
  recoveredMoves: number;
  markers: Marker[];
  notifications: number;
  failedValidation: number;
  failedTypes: Record<string, number>;
  writes: number;
  writeErrors: number;
  driverStats: GanGen4Stats | null;
  /** performance.now() when the snapshot was made, for elapsed times. */
  now: number;
}

const initial: SpikeSnapshot = {
  status: 'idle',
  message: null,
  deviceName: null,
  mac: null,
  macSource: null,
  connectedAt: null,
  connections: 0,
  disconnects: [],
  battery: null,
  hardware: null,
  facelets: null,
  faceletsCount: 0,
  gyro: null,
  gyroCount: 0,
  gyroHz: 0,
  moves: [],
  serialGaps: 0,
  recoveredMoves: 0,
  markers: [],
  notifications: 0,
  failedValidation: 0,
  failedTypes: {},
  writes: 0,
  writeErrors: 0,
  driverStats: null,
  now: 0,
};

let snapshot = initial;
const listeners = new Set<() => void>();
let device: BluetoothDevice | null = null;
let connection: GanGen4Connection | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let gyroTimes: number[] = [];
let firstMoveOfConnection = 0;
// Saved once the cube reports its model name: with a wrong MAC a few noise
// packets still pass the structural check, but a readable HARDWARE event does not appear.
let macToSave: { name: string | undefined; mac: string } | null = null;
const startedAt = { iso: new Date().toISOString() };
let traffic: GanTrafficRecord[] = [];
let events: { t: number; event: GanCubeEvent }[] = [];
let connectionLog: { t: number; type: string; detail?: string }[] = [];

function set(patch: Partial<SpikeSnapshot>) {
  snapshot = { ...snapshot, ...patch, now: performance.now(), driverStats: connection ? { ...connection.stats } : snapshot.driverStats };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => initial;

const macKey = (name: string) => `gan-i4-spike:mac:${name}`;
function savedMac(name: string | undefined): string | null {
  if (!name) return null;
  try { return localStorage.getItem(macKey(name)); } catch { return null; }
}
function saveMac(name: string | undefined, mac: string) {
  if (!name) return;
  try { localStorage.setItem(macKey(name), mac); } catch { /* private mode */ }
}

const errorText = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error));

function log(type: string, detail?: string) {
  connectionLog.push({ t: performance.now(), type, detail });
}

function onEvent(event: GanCubeEvent) {
  const t = performance.now();
  events.push({ t, event });
  switch (event.type) {
    case 'MOVE': {
      // Serials continue across reconnects, but moves made while disconnected are not gaps.
      const prev = snapshot.moves.length > firstMoveOfConnection ? snapshot.moves[snapshot.moves.length - 1] : undefined;
      const serialGap = prev !== undefined && ((event.serial - prev.serial) & 0xff) !== 1;
      const row: MoveRow = {
        index: snapshot.moves.length,
        serial: event.serial,
        move: event.move,
        cubeTimestamp: event.cubeTimestamp,
        localTimestamp: event.localTimestamp,
        serialGap,
      };
      set({
        moves: [...snapshot.moves, row],
        serialGaps: snapshot.serialGaps + (serialGap ? 1 : 0),
        recoveredMoves: snapshot.recoveredMoves + (event.localTimestamp === null ? 1 : 0),
      });
      break;
    }
    case 'FACELETS':
      set({ facelets: { facelets: event.facelets, serial: event.serial, t }, faceletsCount: snapshot.faceletsCount + 1 });
      break;
    case 'GYRO':
      gyroTimes.push(t);
      gyroTimes = gyroTimes.filter((x) => t - x <= 2000);
      set({ gyro: event, gyroCount: snapshot.gyroCount + 1, gyroHz: gyroTimes.length / 2 });
      break;
    case 'BATTERY':
      set({ battery: { level: event.batteryLevel, t } });
      break;
    case 'HARDWARE':
      if (macToSave && event.hardwareName?.startsWith('GAN')) {
        saveMac(macToSave.name, macToSave.mac);
        macToSave = null;
      }
      set({ hardware: event });
      break;
  }
}

function onTraffic(record: GanTrafficRecord) {
  traffic.push(record);
  if (record.op === 'write') {
    set({ writes: snapshot.writes + 1, writeErrors: snapshot.writeErrors + (record.error ? 1 : 0) });
  } else if (record.valid) {
    set({ notifications: snapshot.notifications + 1 });
  } else {
    const type = record.plain ? `0x${record.plain.slice(0, 2)}` : 'short';
    set({
      notifications: snapshot.notifications + 1,
      failedValidation: snapshot.failedValidation + 1,
      failedTypes: { ...snapshot.failedTypes, [type]: (snapshot.failedTypes[type] ?? 0) + 1 },
    });
  }
}

function onDisconnect(reason: string) {
  const t = performance.now();
  log('disconnected', reason);
  connection = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
  set({
    status: 'disconnected',
    message: reason,
    disconnects: [...snapshot.disconnects, { t, reason, connectedMs: snapshot.connectedAt === null ? null : t - snapshot.connectedAt }],
    connectedAt: null,
  });
}

async function connectWith(mac: string, source: SpikeSnapshot['macSource']) {
  if (!device) return;
  set({ status: 'connecting', message: null, mac, macSource: source });
  log('connecting', `${device.name ?? '?'} ${mac} (${source})`);
  try {
    connection = await connectGanGen4(device, mac, { onEvent, onTraffic, onDisconnect });
  } catch (error) {
    log('error', errorText(error));
    set({ status: 'error', message: errorText(error) });
    return;
  }
  macToSave = { name: device.name, mac };
  firstMoveOfConnection = snapshot.moves.length;
  log('connected');
  ticker = setInterval(() => set({}), 1000);
  set({ status: 'connected', connectedAt: performance.now(), connections: snapshot.connections + 1 });
  // Moves are only accepted after the first FACELETS event, so ask for it right away.
  for (const type of ['REQUEST_HARDWARE', 'REQUEST_FACELETS', 'REQUEST_BATTERY'] as const) {
    await command(type);
  }
}

/** Choose a cube, find its MAC and connect. Call from a click handler. */
export async function connect(typedMac: string) {
  if (!webBluetoothSupport().bluetooth) {
    set({ status: 'error', message: 'Web Bluetooth is not available in this browser.' });
    return;
  }
  set({ status: 'choosing', message: null });
  try {
    // First thing in the handler, to keep the user activation.
    device = await requestGanCube();
  } catch (error) {
    set({ status: snapshot.connectedAt ? 'connected' : 'idle', message: errorText(error) });
    return;
  }
  log('chosen', device.name);
  set({ deviceName: device.name ?? null });

  const typed = parseMac(typedMac);
  if (typed) return connectWith(formatMac(typed), 'typed');
  const saved = savedMac(device.name);
  if (saved && parseMac(saved)) return connectWith(saved, 'saved');
  if (webBluetoothSupport().watchAdvertisements) {
    set({ status: 'reading-mac' });
    const fromAd = await watchGanMac(device);
    log('mac-from-advertisement', fromAd ?? 'none');
    if (fromAd) return connectWith(fromAd, 'advertisement');
  }
  set({
    status: 'needs-mac',
    message: 'The MAC address could not be read automatically. Type it in and press Continue.',
  });
}

/** Continue with a typed MAC after needs-mac, or reconnect the chosen cube. */
export async function continueWithMac(typedMac: string) {
  const typed = parseMac(typedMac);
  if (typed) return connectWith(formatMac(typed), 'typed');
  if (snapshot.mac && !typedMac.trim()) return connectWith(snapshot.mac, snapshot.macSource);
  set({ message: 'Enter the MAC as six hex pairs, e.g. AB:12:CD:34:EF:56' });
}

export function disconnect() {
  connection?.disconnect();
}

export async function command(type: GanCubeCommand['type']) {
  if (!connection) return;
  log('command', type);
  try {
    await connection.sendCommand({ type });
  } catch (error) {
    set({ message: `${type} failed: ${errorText(error)}` });
  }
}

export function addMarker(label: string) {
  const text = label.trim();
  if (!text) return;
  set({ markers: [...snapshot.markers, { t: performance.now(), label: text, moveIndex: snapshot.moves.length }] });
}

export const hasChosenDevice = () => device !== null;

export function clearLog() {
  traffic = [];
  events = [];
  connectionLog = [];
  gyroTimes = [];
  firstMoveOfConnection = 0;
  startedAt.iso = new Date().toISOString();
  set({
    moves: [],
    serialGaps: 0,
    recoveredMoves: 0,
    markers: [],
    notifications: 0,
    failedValidation: 0,
    failedTypes: {},
    writes: 0,
    writeErrors: 0,
    faceletsCount: 0,
    gyroCount: 0,
    disconnects: [],
  });
}

/** Everything recorded since the page loaded (or the last clear), as JSON text. */
export function exportJson(): string {
  return JSON.stringify({
    format: 'cfop-trainer-gan-spike',
    version: 1,
    startedAt: startedAt.iso,
    savedAt: new Date().toISOString(),
    // performance.now() values below are relative to this epoch time (ms).
    timeOrigin: performance.timeOrigin,
    userAgent: navigator.userAgent,
    support: webBluetoothSupport(),
    device: { name: snapshot.deviceName, mac: snapshot.mac, macSource: snapshot.macSource },
    protocol: 'gan-gen4',
    summary: {
      moves: snapshot.moves.length,
      serialGaps: snapshot.serialGaps,
      recoveredMoves: snapshot.recoveredMoves,
      notifications: snapshot.notifications,
      failedValidation: snapshot.failedValidation,
      failedTypes: snapshot.failedTypes,
      writes: snapshot.writes,
      writeErrors: snapshot.writeErrors,
      gyroCount: snapshot.gyroCount,
      faceletsCount: snapshot.faceletsCount,
      battery: snapshot.battery,
      hardware: snapshot.hardware,
      driverStats: snapshot.driverStats,
      connections: snapshot.connections,
      disconnects: snapshot.disconnects,
    },
    markers: snapshot.markers,
    connectionLog,
    events,
    traffic,
  }, null, 1);
}
