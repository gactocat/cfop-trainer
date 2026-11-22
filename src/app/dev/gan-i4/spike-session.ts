// State of the /dev/gan-i4 spike: one cube connection, everything it reports,
// and a log that can be saved as JSON. Kept outside React and read through
// useSyncExternalStore, like the app's stores.
//
// Everything that happens is appended to one record list, which is also
// written to IndexedDB (spike-store.ts). The on-screen snapshot is derived
// from those records by `reduce`, both live and when a reloaded page restores
// the session, so a reload loses nothing but the connection itself.

import {
  connectGanGen4,
  requestGanCube,
  watchGanMac,
  webBluetoothSupport,
  type GanGen4Connection,
  type GanTrafficRecord,
} from '@/lib/smart-cube/gan-web-bluetooth';
import { parseMac, formatMac, type GanCubeCommand, type GanCubeEvent, type GanGen4Stats } from '@/lib/smart-cube/gan-gen4';
import * as store from './spike-store';

export type SpikeStatus =
  | 'idle'
  | 'choosing'
  | 'reading-mac'
  | 'needs-mac'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

type MacSource = 'typed' | 'saved' | 'advertisement';

export interface MoveRow {
  index: number;
  serial: number;
  move: string;
  /** Cube clock, ms. Null when recovered from history. */
  cubeTimestamp: number | null;
  /** Session time at arrival, ms. Null when recovered from history. */
  localTimestamp: number | null;
  /** The serial does not follow the previous move of the same connection. */
  serialGap: boolean;
}

export interface Marker {
  t: number;
  label: string;
  /** Index of the first move after the marker. */
  moveIndex: number;
}

/** One entry of the session log. `t` is ms since the session started. */
type SpikeRecord =
  | { kind: 'traffic'; t: number; data: GanTrafficRecord }
  | { kind: 'event'; t: number; event: GanCubeEvent }
  | { kind: 'conn'; t: number; type: string; detail?: string; name?: string; mac?: string; source?: MacSource }
  | { kind: 'marker'; t: number; label: string; moveIndex: number }
  | { kind: 'stats'; t: number; stats: GanGen4Stats };

export interface SpikeSnapshot {
  /** False until a stored session has been restored. */
  ready: boolean;
  status: SpikeStatus;
  message: string | null;
  deviceName: string | null;
  mac: string | null;
  macSource: MacSource | null;
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
  lastNotificationAt: number | null;
  failedValidation: number;
  failedTypes: Record<string, number>;
  writes: number;
  writeErrors: number;
  driverStats: GanGen4Stats | null;
  recordCount: number;
  /** Records not included in the last saved JSON. */
  unsavedRecords: number;
  exportedAt: string | null;
  restoredRecords: number;
  persistError: string | null;
  /** Session time when the snapshot was made, for elapsed times. */
  now: number;
}

const initial: SpikeSnapshot = {
  ready: false,
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
  lastNotificationAt: null,
  failedValidation: 0,
  failedTypes: {},
  writes: 0,
  writeErrors: 0,
  driverStats: null,
  recordCount: 0,
  unsavedRecords: 0,
  exportedAt: null,
  restoredRecords: 0,
  persistError: null,
  now: 0,
};

const newMeta = (origin: number): store.SpikeMeta => ({
  sessionOrigin: origin,
  startedAt: new Date(origin).toISOString(),
  exportedRecords: 0,
  exportedAt: null,
});

let snapshot = initial;
const listeners = new Set<() => void>();
let meta: store.SpikeMeta = newMeta(0);
let records: SpikeRecord[] = [];
let pending: SpikeRecord[] = [];
let device: BluetoothDevice | null = null;
let connection: GanGen4Connection | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let gyroTimes: number[] = [];
let firstMoveOfConnection = 0;
let lastStats = '';
// Saved once the cube reports its model name: with a wrong MAC a few noise
// packets still pass the structural check, but a readable HARDWARE event does not appear.
let macToSave: { name: string | undefined; mac: string } | null = null;

/** ms since the session started; continues across reloads. */
const clock = () => performance.timeOrigin + performance.now() - meta.sessionOrigin;

function notify() {
  snapshot = {
    ...snapshot,
    now: clock(),
    driverStats: connection ? { ...connection.stats } : snapshot.driverStats,
    recordCount: records.length,
    unsavedRecords: Math.max(0, records.length - meta.exportedRecords),
    exportedAt: meta.exportedAt,
  };
  listeners.forEach((l) => l());
}

function set(patch: Partial<SpikeSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  notify();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => initial;

// The snapshot change caused by one record. Used live and on restore.
function reduce(rec: SpikeRecord): Partial<SpikeSnapshot> {
  const s = snapshot;
  switch (rec.kind) {
    case 'traffic': {
      const r = rec.data;
      if (r.op === 'write') return { writes: s.writes + 1, writeErrors: s.writeErrors + (r.error ? 1 : 0) };
      if (r.valid) return { notifications: s.notifications + 1, lastNotificationAt: rec.t };
      const type = r.plain ? `0x${r.plain.slice(0, 2)}` : 'short';
      return {
        notifications: s.notifications + 1,
        lastNotificationAt: rec.t,
        failedValidation: s.failedValidation + 1,
        failedTypes: { ...s.failedTypes, [type]: (s.failedTypes[type] ?? 0) + 1 },
      };
    }
    case 'event': {
      const e = rec.event;
      switch (e.type) {
        case 'MOVE': {
          // Serials continue across reconnects, but moves made while disconnected are not gaps.
          const prev = s.moves.length > firstMoveOfConnection ? s.moves[s.moves.length - 1] : undefined;
          const serialGap = prev !== undefined && ((e.serial - prev.serial) & 0xff) !== 1;
          const row: MoveRow = {
            index: s.moves.length,
            serial: e.serial,
            move: e.move,
            cubeTimestamp: e.cubeTimestamp,
            localTimestamp: e.localTimestamp,
            serialGap,
          };
          return {
            moves: [...s.moves, row],
            serialGaps: s.serialGaps + (serialGap ? 1 : 0),
            recoveredMoves: s.recoveredMoves + (e.localTimestamp === null ? 1 : 0),
          };
        }
        case 'FACELETS':
          return { facelets: { facelets: e.facelets, serial: e.serial, t: rec.t }, faceletsCount: s.faceletsCount + 1 };
        case 'GYRO':
          gyroTimes.push(rec.t);
          gyroTimes = gyroTimes.filter((x) => rec.t - x <= 2000);
          return { gyro: e, gyroCount: s.gyroCount + 1, gyroHz: gyroTimes.length / 2 };
        case 'BATTERY':
          return { battery: { level: e.batteryLevel, t: rec.t } };
        case 'HARDWARE':
          return { hardware: e };
      }
      return {};
    }
    case 'conn':
      switch (rec.type) {
        case 'chosen':
          return { deviceName: rec.name ?? null };
        case 'connecting':
          return { deviceName: rec.name ?? null, mac: rec.mac ?? null, macSource: rec.source ?? null };
        case 'connected':
          firstMoveOfConnection = s.moves.length;
          return { status: 'connected', connectedAt: rec.t, connections: s.connections + 1 };
        case 'disconnected':
          return {
            status: 'disconnected',
            message: rec.detail ?? null,
            connectedAt: null,
            disconnects: [...s.disconnects, { t: rec.t, reason: rec.detail ?? '', connectedMs: s.connectedAt === null ? null : rec.t - s.connectedAt }],
          };
      }
      return {};
    case 'marker':
      return { markers: [...s.markers, { t: rec.t, label: rec.label, moveIndex: rec.moveIndex }] };
    case 'stats':
      return { driverStats: rec.stats };
  }
}

function apply(rec: SpikeRecord) {
  records.push(rec);
  snapshot = { ...snapshot, ...reduce(rec) };
}

/** Append a record live: update the snapshot, queue it for IndexedDB and re-render. */
function record(rec: SpikeRecord) {
  apply(rec);
  pending.push(rec);
  notify();
}

function conn(type: string, extra: Omit<Extract<SpikeRecord, { kind: 'conn' }>, 'kind' | 't' | 'type'> = {}) {
  record({ kind: 'conn', t: clock(), type, ...extra });
}

async function flush() {
  if (!store.persistenceAvailable() || !snapshot.ready) return;
  if (connection) {
    const stats = JSON.stringify(connection.stats);
    if (stats !== lastStats) {
      lastStats = stats;
      record({ kind: 'stats', t: clock(), stats: { ...connection.stats } });
    }
  }
  const batch = pending;
  pending = [];
  try {
    await store.append(batch, meta);
    if (snapshot.persistError) set({ persistError: null });
  } catch (error) {
    pending = batch.concat(pending);
    set({ persistError: errorText(error) });
  }
}

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

function onEvent(event: GanCubeEvent) {
  record({ kind: 'event', t: clock(), event });
  if (event.type === 'HARDWARE' && macToSave && event.hardwareName?.startsWith('GAN')) {
    saveMac(macToSave.name, macToSave.mac);
    macToSave = null;
  }
}

function onTraffic(data: GanTrafficRecord) {
  record({ kind: 'traffic', t: data.t, data });
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

function onDisconnect(reason: string) {
  connection = null;
  stopTicker();
  conn('disconnected', { detail: reason });
  void flush();
}

async function connectWith(mac: string, source: MacSource) {
  if (!device) return;
  set({ status: 'connecting', message: null });
  conn('connecting', { detail: `${device.name ?? '?'} ${mac} (${source})`, name: device.name, mac, source });
  try {
    connection = await connectGanGen4(device, mac, { onEvent, onTraffic, onDisconnect }, { now: clock });
  } catch (error) {
    conn('error', { detail: errorText(error) });
    set({ status: 'error', message: errorText(error) });
    return;
  }
  macToSave = { name: device.name, mac };
  lastStats = '';
  conn('connected');
  // Refresh elapsed times even when the cube sends nothing.
  ticker = setInterval(notify, 1000);
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
  const before = snapshot.status;
  set({ status: 'choosing', message: null });
  try {
    // First thing in the handler, to keep the user activation.
    device = await requestGanCube();
  } catch (error) {
    set({ status: before === 'choosing' ? 'idle' : before, message: errorText(error) });
    return;
  }
  conn('chosen', { detail: device.name, name: device.name });

  const typed = parseMac(typedMac);
  if (typed) return connectWith(formatMac(typed), 'typed');
  const saved = savedMac(device.name);
  if (saved && parseMac(saved)) return connectWith(saved, 'saved');
  if (webBluetoothSupport().watchAdvertisements) {
    set({ status: 'reading-mac' });
    const fromAd = await watchGanMac(device);
    conn('mac-from-advertisement', { detail: fromAd ?? 'none' });
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
  if (snapshot.mac && snapshot.macSource && !typedMac.trim()) return connectWith(snapshot.mac, snapshot.macSource);
  set({ message: 'Enter the MAC as six hex pairs, e.g. AB:12:CD:34:EF:56' });
}

export function disconnect() {
  connection?.disconnect();
}

export async function command(type: GanCubeCommand['type']) {
  if (!connection) return;
  conn('command', { detail: type });
  try {
    await connection.sendCommand({ type });
  } catch (error) {
    set({ message: `${type} failed: ${errorText(error)}` });
  }
}

export function addMarker(label: string) {
  const text = label.trim();
  if (!text) return;
  record({ kind: 'marker', t: clock(), label: text, moveIndex: snapshot.moves.length });
}

export const hasChosenDevice = () => device !== null;

/** Forget every remembered MAC, so the next connection reads it again. */
export function forgetSavedMacs() {
  let removed = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('gan-i4-spike:mac:')) {
        localStorage.removeItem(key);
        removed++;
      }
    }
  } catch { /* private mode */ }
  set({ message: removed ? `Forgot ${removed} saved MAC address(es).` : 'No saved MAC address.' });
}

export function clearLog() {
  records = [];
  pending = [];
  gyroTimes = [];
  firstMoveOfConnection = 0;
  meta = newMeta(performance.timeOrigin + performance.now());
  const keep = {
    status: snapshot.status,
    deviceName: snapshot.deviceName,
    mac: snapshot.mac,
    macSource: snapshot.macSource,
  };
  snapshot = { ...initial, ...keep, ready: true };
  if (connection) {
    // The link continues; restart its timeline at the new session origin.
    record({ kind: 'conn', t: 0, type: 'connecting', detail: 'log cleared while connected', name: keep.deviceName ?? undefined, mac: keep.mac ?? undefined, source: keep.macSource ?? undefined });
    record({ kind: 'conn', t: 0, type: 'connected', detail: 'log cleared while connected' });
  }
  if (store.persistenceAvailable()) {
    store.reset(meta).catch((error) => set({ persistError: errorText(error) }));
  }
  notify();
}

/** Everything recorded in this session (across reloads, since the last clear), as JSON text. */
export function exportJson(): string {
  const text = JSON.stringify({
    format: 'cfop-trainer-gan-spike',
    version: 1,
    startedAt: meta.startedAt,
    savedAt: new Date().toISOString(),
    // Every `t` below is ms since this epoch time.
    timeOrigin: meta.sessionOrigin,
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
    connectionLog: records.flatMap((r) => (r.kind === 'conn' ? [{ t: r.t, type: r.type, detail: r.detail }] : [])),
    events: records.flatMap((r) => (r.kind === 'event' ? [{ t: r.t, event: r.event }] : [])),
    traffic: records.flatMap((r) => (r.kind === 'traffic' ? [r.data] : [])),
  }, null, 1);
  meta = { ...meta, exportedRecords: records.length, exportedAt: new Date().toISOString() };
  void flush();
  notify();
  return text;
}

// Rebuild the previous session from IndexedDB, or start a new one.
async function restore() {
  meta = newMeta(performance.timeOrigin);
  if (!store.persistenceAvailable()) {
    set({ ready: true, persistError: 'IndexedDB is not available; a reload loses the log.' });
    return;
  }
  try {
    const stored = await store.load<SpikeRecord>();
    if (stored.meta && stored.records.length > 0) {
      meta = stored.meta;
      for (const rec of stored.records) apply(rec);
      snapshot = { ...snapshot, ready: true, restoredRecords: stored.records.length, status: 'idle' };
      // The page went away mid-connection; the exact time is unknown, so use the last record.
      if (snapshot.connectedAt !== null) {
        const last = stored.records[stored.records.length - 1].t;
        record({ kind: 'conn', t: last, type: 'disconnected', detail: 'page reloaded or closed while connected' });
        snapshot = { ...snapshot, status: 'idle' };
      }
      record({ kind: 'conn', t: clock(), type: 'page-reloaded', detail: `restored ${stored.records.length} records` });
      set({ message: `Restored ${stored.records.length} records from before the reload. Choose the cube again to reconnect.` });
    } else {
      await store.reset(meta);
      set({ ready: true });
    }
  } catch (error) {
    set({ ready: true, persistError: errorText(error) });
  }
}

if (typeof window !== 'undefined') {
  void restore();
  setInterval(() => { void flush(); }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
    else notify();
  });
  window.addEventListener('pagehide', () => { void flush(); });
  // Warn before a reload or close drops the link or leaves unsaved records.
  window.addEventListener('beforeunload', (event) => {
    void flush();
    if (connection || snapshot.unsavedRecords > 0) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
