// iOS app transport for GAN Gen4 cubes, over @capacitor-community/bluetooth-le.
// WKWebView has no Web Bluetooth, so the app scans and connects through the
// plugin; the protocol is the same session as in the browser. Loaded only in
// the app (the store imports it on demand), so web bundles do not carry it.

import { BleClient } from '@capacitor-community/bluetooth-le';
import {
  GAN_GEN4_COMMAND_CHARACTERISTIC,
  GAN_GEN4_SERVICE,
  GAN_GEN4_STATE_CHARACTERISTIC,
  macFromCompanyData,
  parseMac,
} from '@/lib/smart-cube/gan-gen4';
import {
  MAC_FORMAT_ERROR,
  NOT_GEN4_ERROR,
  startGanGen4Session,
  type GanConnectionHandlers,
  type GanConnectionOptions,
  type GanGen4Connection,
} from '@/lib/smart-cube/gan-gen4-session';

export interface FoundCube {
  /** CoreBluetooth's identifier for the cube, stable for this app installation. */
  deviceId: string;
  name: string;
  /** Read from the advertisement, when the cube included it. */
  mac: string | null;
}

/** Why Bluetooth cannot be used right now. */
export type NativeBluetoothProblem = 'bluetooth-off' | 'bluetooth-denied' | 'bluetooth-unavailable';

export class NativeBluetoothError extends Error {
  // A plain field, not a parameter property, so the Node checks can load this module.
  readonly problem: NativeBluetoothProblem;
  constructor(problem: NativeBluetoothProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}

let ready: Promise<void> | null = null;
// Bluetooth is set up (and cubes connected) only once leftovers are released: see releaseLeftoverCubes.
let leftovers: Promise<number> = Promise.resolve(0);

/** Ask for Bluetooth (the first call shows iOS's permission prompt) and check it is on. */
async function ensureBluetooth(): Promise<void> {
  // Setting up anew replaces the plugin's manager that holds any leftover link.
  await leftovers;
  ready ??= BleClient.initialize().catch((error: unknown) => {
    // Let a later attempt ask again, e.g. after the user allowed it in Settings.
    ready = null;
    const message = error instanceof Error ? error.message : String(error);
    throw new NativeBluetoothError(/denied|unauthori[sz]ed/i.test(message) ? 'bluetooth-denied' : 'bluetooth-unavailable', message);
  });
  await ready;
  if (!(await BleClient.isEnabled())) throw new NativeBluetoothError('bluetooth-off', 'Bluetooth is off');
}

const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Scan for cubes whose name starts with GAN. `onFound` is called for each
 * advertisement (the same cube repeats, and its MAC may come in a later one).
 * Resolves with a function that stops the scan.
 */
export async function scanGanCubes(onFound: (cube: FoundCube) => void): Promise<() => Promise<void>> {
  await ensureBluetooth();
  await BleClient.requestLEScan({ namePrefix: 'GAN', allowDuplicates: true }, (result) => {
    const name = result.localName ?? result.device.name;
    if (!name?.startsWith('GAN')) return;
    // GAN puts the MAC at the end of its manufacturer data.
    onFound({ deviceId: result.device.deviceId, name, mac: macFromCompanyData(result.manufacturerData) });
  });
  return () => BleClient.stopLEScan().catch(() => {});
}

/** Whether iOS still knows a cube connected before, so it can connect without a scan. */
export async function isKnownCube(deviceId: string): Promise<boolean> {
  await ensureBluetooth();
  const devices = await BleClient.getDevices([deviceId]).catch(() => []);
  return devices.some((d) => d.deviceId === deviceId);
}

const CONNECT_TIMEOUT_MS = 10000;

// Links being released, by device: connecting again waits for the release,
// so its disconnect cannot end the new link (the plugin runs calls in order,
// and the disconnect is queued only once the stop has finished).
const releasing = new Map<string, Promise<void>>();

/**
 * End a link: stop notifications, then disconnect (CoreBluetooth's
 * cancelPeripheralConnection), even when the stop fails. A linked cube does
 * not advertise, so other apps cannot find it until this is done.
 */
function release(deviceId: string): Promise<void> {
  const done = (async () => {
    await BleClient.stopNotifications(deviceId, GAN_GEN4_SERVICE, GAN_GEN4_STATE_CHARACTERISTIC).catch(() => {});
    await BleClient.disconnect(deviceId).catch(() => {});
  })();
  releasing.set(deviceId, done);
  void done.finally(() => { if (releasing.get(deviceId) === done) releasing.delete(deviceId); });
  return done;
}

/**
 * Disconnect GAN cubes the plugin still holds for an earlier page. The plugin
 * lives as long as the app and the page does not: iOS ends the web view's
 * process (in the background, for one) and Capacitor loads the page again,
 * while the link stays up. The new page knows nothing of it, so no button
 * could end it, and the cube, still linked, stays hidden from other apps.
 * Only a plugin that an earlier page set up can hold such a link; on a fresh
 * launch the call fails before Bluetooth is set up, so no permission prompt
 * appears. Cubes linked to other apps are not this app's to end and stay.
 */
export function releaseLeftoverCubes(): Promise<number> {
  leftovers = (async () => {
    const devices = await BleClient.getConnectedDevices([GAN_GEN4_SERVICE]).catch(() => []);
    await Promise.all(devices.map((d) => BleClient.disconnect(d.deviceId).catch(() => {})));
    return devices.length;
  })();
  return leftovers;
}

export async function connectNativeGanGen4(
  cube: { deviceId: string; name: string },
  mac: string,
  handlers: GanConnectionHandlers,
  options: GanConnectionOptions = {},
): Promise<GanGen4Connection> {
  if (!parseMac(mac)) throw new Error(MAC_FORMAT_ERROR);
  await ensureBluetooth();
  const { deviceId } = cube;
  await releasing.get(deviceId);
  let session: ReturnType<typeof startGanGen4Session> | null = null;
  await BleClient.connect(
    deviceId,
    () => session?.close('the Bluetooth link dropped (peripheral disconnected)'),
    { timeout: CONNECT_TIMEOUT_MS },
  );

  let withResponse = true;
  try {
    const service = (await BleClient.getServices(deviceId)).find((s) => sameUuid(s.uuid, GAN_GEN4_SERVICE));
    if (!service) throw new Error(NOT_GEN4_ERROR);
    const command = service.characteristics.find((c) => sameUuid(c.uuid, GAN_GEN4_COMMAND_CHARACTERISTIC));
    const state = service.characteristics.find((c) => sameUuid(c.uuid, GAN_GEN4_STATE_CHARACTERISTIC));
    if (!command || !state) throw new Error(NOT_GEN4_ERROR);
    withResponse = !(command.properties.writeWithoutResponse && !command.properties.write);
  } catch (error) {
    // Do not leave a half-set-up link open.
    await BleClient.disconnect(deviceId).catch(() => {});
    throw error;
  }

  const opened = startGanGen4Session(cube.name, mac, handlers, {
    write: async (data) => {
      const value = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (withResponse) await BleClient.write(deviceId, GAN_GEN4_SERVICE, GAN_GEN4_COMMAND_CHARACTERISTIC, value);
      else await BleClient.writeWithoutResponse(deviceId, GAN_GEN4_SERVICE, GAN_GEN4_COMMAND_CHARACTERISTIC, value);
    },
    close: () => { void release(deviceId); },
  }, options);
  session = opened;

  try {
    await BleClient.startNotifications(deviceId, GAN_GEN4_SERVICE, GAN_GEN4_STATE_CHARACTERISTIC, (value) => {
      opened.receive(new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)));
    });
  } catch (error) {
    opened.close('notifications could not start', false);
    throw error;
  }
  return opened.connection;
}

/** Open this app's page in iOS Settings, where Bluetooth can be allowed again. */
export function openAppSettings(): Promise<void> {
  return BleClient.openAppSettings();
}
