/// <reference types="web-bluetooth" />
// Web Bluetooth transport for GAN Gen4 cubes. The protocol lives in gan-gen4.ts
// and gan-gen4-session.ts, shared with the iOS app's transport.
//
// Flow: requestGanCube() from a click handler, then resolve the MAC (typed in,
// or watchGanMac() where Chrome exposes advertisements), then connectGanGen4().

import {
  GAN_CIC_LIST,
  GAN_GEN4_COMMAND_CHARACTERISTIC,
  GAN_GEN4_SERVICE,
  GAN_GEN4_STATE_CHARACTERISTIC,
  macFromManufacturerData,
  parseMac,
} from '@/lib/smart-cube/gan-gen4';
import {
  MAC_FORMAT_ERROR,
  NOT_GEN4_ERROR,
  startGanGen4Session,
  type GanConnectionHandlers,
  type GanConnectionOptions,
  type GanGen4Connection,
  type GanTrafficRecord,
} from '@/lib/smart-cube/gan-gen4-session';

export interface WebBluetoothSupport {
  secureContext: boolean;
  bluetooth: boolean;
  /** Chrome exposes this only with chrome://flags/#enable-experimental-web-platform-features. */
  watchAdvertisements: boolean;
}

// BluetoothDevice is only typed as an interface, but browsers expose the constructor.
const bluetoothDeviceProto = () =>
  (globalThis as { BluetoothDevice?: { prototype: Partial<BluetoothDevice> } }).BluetoothDevice?.prototype;

export function webBluetoothSupport(): WebBluetoothSupport {
  const hasWindow = typeof window !== 'undefined';
  return {
    secureContext: hasWindow && window.isSecureContext,
    bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    watchAdvertisements: hasWindow && typeof bluetoothDeviceProto()?.watchAdvertisements === 'function',
  };
}

/** Open the browser's device chooser. Must be called from a user gesture. */
export function requestGanCube(): Promise<BluetoothDevice> {
  return navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'GAN' }],
    optionalServices: [GAN_GEN4_SERVICE],
    // Needed to read the MAC from advertisements.
    optionalManufacturerData: GAN_CIC_LIST,
  });
}

function macFromAdvertisement(data: BluetoothManufacturerData | DataView): string | null {
  // Bluefy hands over the raw manufacturer data instead of a Map.
  if (data instanceof DataView) {
    return macFromManufacturerData(new DataView(data.buffer, data.byteOffset + 2, Math.max(0, data.byteLength - 2)));
  }
  for (const id of GAN_CIC_LIST) {
    const value = data.get(id);
    if (value) return macFromManufacturerData(value);
  }
  return null;
}

/**
 * Read the MAC from the cube's advertisements, before connecting (a connected
 * cube may stop advertising). Resolves null when the browser does not support
 * it or nothing arrives within the timeout.
 */
export function watchGanMac(device: BluetoothDevice, timeoutMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof device.watchAdvertisements !== 'function') {
      resolve(null);
      return;
    }
    const abort = new AbortController();
    let done = false;
    const finish = (mac: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      device.removeEventListener('advertisementreceived', onAdvertisement);
      abort.abort();
      resolve(mac);
    };
    const onAdvertisement = (event: Event) => {
      const mac = macFromAdvertisement((event as BluetoothAdvertisingEvent).manufacturerData);
      if (mac) finish(mac);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    device.addEventListener('advertisementreceived', onAdvertisement);
    device.watchAdvertisements({ signal: abort.signal }).catch(() => finish(null));
  });
}

export type { GanConnectionHandlers, GanConnectionOptions, GanGen4Connection, GanTrafficRecord };

/** How long a link's end waits for the cube to confirm that notifications stopped. */
const STOP_NOTIFICATIONS_MS = 1000;

// Links being released, by device: connecting again waits for the release,
// so its disconnect cannot end the new link.
const releasing = new WeakMap<BluetoothDevice, Promise<void>>();

/**
 * End a link: stop notifications, then disconnect. Other GAN clients
 * (smartcube-web-bluetooth, csTimer) wait for the stop before disconnecting,
 * and some stacks keep the link up while notifications are on (Chrome on
 * Windows); a linked cube does not advertise, so other apps cannot find it.
 * The disconnect comes even when the stop fails or does not answer.
 */
function release(device: BluetoothDevice, stateChar: BluetoothRemoteGATTCharacteristic): Promise<void> {
  const done = (async () => {
    if (!device.gatt?.connected) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      stateChar.stopNotifications().catch(() => {}),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, STOP_NOTIFICATIONS_MS); }),
    ]);
    clearTimeout(timer);
    device.gatt?.disconnect();
  })();
  releasing.set(device, done);
  void done.finally(() => { if (releasing.get(device) === done) releasing.delete(device); });
  return done;
}

/** Connect to a Gen4 cube chosen with requestGanCube(), using its MAC for the keys. */
export async function connectGanGen4(
  device: BluetoothDevice,
  mac: string,
  handlers: GanConnectionHandlers,
  options: GanConnectionOptions = {},
): Promise<GanGen4Connection> {
  if (!parseMac(mac)) throw new Error(MAC_FORMAT_ERROR);
  if (!device.gatt) throw new Error('This device has no GATT server');

  await releasing.get(device);
  const server = await device.gatt.connect();
  let commandChar: BluetoothRemoteGATTCharacteristic;
  let stateChar: BluetoothRemoteGATTCharacteristic;
  try {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(GAN_GEN4_SERVICE);
    } catch {
      throw new Error(NOT_GEN4_ERROR);
    }
    commandChar = await service.getCharacteristic(GAN_GEN4_COMMAND_CHARACTERISTIC);
    stateChar = await service.getCharacteristic(GAN_GEN4_STATE_CHARACTERISTIC);
  } catch (error) {
    // Do not leave a half-set-up link open.
    server.disconnect();
    throw error;
  }

  const onNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) session.receive(new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)));
  };
  const onGattDisconnected = () => session.close('the Bluetooth link dropped (gattserverdisconnected)');

  const session = startGanGen4Session(device.name ?? 'GAN', mac, handlers, {
    write: async (data) => {
      const { write: withResponse, writeWithoutResponse } = commandChar.properties;
      if (writeWithoutResponse && !withResponse) await commandChar.writeValueWithoutResponse(data);
      else await commandChar.writeValueWithResponse(data);
    },
    close: () => {
      device.removeEventListener('gattserverdisconnected', onGattDisconnected);
      stateChar.removeEventListener('characteristicvaluechanged', onNotification);
      void release(device, stateChar);
    },
  }, options);

  device.addEventListener('gattserverdisconnected', onGattDisconnected);
  stateChar.addEventListener('characteristicvaluechanged', onNotification);
  try {
    await stateChar.startNotifications();
  } catch (error) {
    session.close('notifications could not start', false);
    throw error;
  }
  return session.connection;
}
