/// <reference types="web-bluetooth" />
// Web Bluetooth transport for GAN Gen4 cubes. The protocol itself lives in
// gan-gen4.ts so a native (Capacitor) transport can reuse it later.
//
// Flow: requestGanCube() from a click handler, then resolve the MAC (typed in,
// or watchGanMac() where Chrome exposes advertisements), then connectGanGen4().

import {
  GAN_CIC_LIST,
  GAN_GEN4_COMMAND_CHARACTERISTIC,
  GAN_GEN4_SERVICE,
  GAN_GEN4_STATE_CHARACTERISTIC,
  GanGen4Cipher,
  GanGen4Driver,
  isValidGanGen4Packet,
  macFromManufacturerData,
  parseMac,
  type GanCubeCommand,
  type GanCubeEvent,
  type GanDriverLink,
  type GanGen4Stats,
} from '@/lib/smart-cube/gan-gen4';

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

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export interface GanTrafficRecord {
  /** performance.now() in ms. */
  t: number;
  op: 'notify' | 'write';
  /** Bytes on the air (encrypted), hex. */
  data: string;
  /** Decrypted bytes, hex. */
  plain: string;
  /** For notifications: whether the decrypted packet passed the structural check. */
  valid?: boolean;
  /** For writes: the error message when the write failed. */
  error?: string;
}

export interface GanConnectionHandlers {
  onEvent(event: GanCubeEvent): void;
  onTraffic?(record: GanTrafficRecord): void;
  /** Called once when the link closes, for whatever reason. */
  onDisconnect(reason: string): void;
}

export interface GanGen4Connection {
  readonly deviceName: string;
  readonly mac: string;
  readonly stats: GanGen4Stats;
  sendCommand(command: GanCubeCommand): Promise<void>;
  disconnect(): void;
}

/** Connect to a Gen4 cube chosen with requestGanCube(), using its MAC for the keys. */
export async function connectGanGen4(
  device: BluetoothDevice,
  mac: string,
  handlers: GanConnectionHandlers,
): Promise<GanGen4Connection> {
  const macBytes = parseMac(mac);
  if (!macBytes) throw new Error('Enter the MAC as six hex pairs, e.g. AB:12:CD:34:EF:56');
  if (!device.gatt) throw new Error('This device has no GATT server');

  const server = await device.gatt.connect();
  let commandChar: BluetoothRemoteGATTCharacteristic;
  let stateChar: BluetoothRemoteGATTCharacteristic;
  try {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(GAN_GEN4_SERVICE);
    } catch {
      throw new Error('The GAN Gen4 service was not found; this cube may use another protocol generation');
    }
    commandChar = await service.getCharacteristic(GAN_GEN4_COMMAND_CHARACTERISTIC);
    stateChar = await service.getCharacteristic(GAN_GEN4_STATE_CHARACTERISTIC);
  } catch (error) {
    // Do not leave a half-set-up link open.
    server.disconnect();
    throw error;
  }

  const cipher = new GanGen4Cipher(macBytes);
  const driver = new GanGen4Driver();
  let closed = false;

  // One GATT operation at a time; overlapping writes fail on common stacks.
  let writeTail: Promise<void> = Promise.resolve();
  const write = (plain: Uint8Array): Promise<void> => {
    const run = writeTail.then(async () => {
      const data = cipher.encrypt(plain);
      const record: GanTrafficRecord = { t: performance.now(), op: 'write', data: toHex(data), plain: toHex(plain) };
      try {
        const { write: withResponse, writeWithoutResponse } = commandChar.properties;
        if (writeWithoutResponse && !withResponse) await commandChar.writeValueWithoutResponse(data);
        else await commandChar.writeValueWithResponse(data);
      } catch (error) {
        record.error = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        handlers.onTraffic?.(record);
      }
    });
    writeTail = run.catch(() => {});
    return run;
  };

  const close = (reason: string) => {
    if (closed) return;
    closed = true;
    device.removeEventListener('gattserverdisconnected', onGattDisconnected);
    stateChar.removeEventListener('characteristicvaluechanged', onNotification);
    if (device.gatt?.connected) {
      stateChar.stopNotifications().catch(() => {});
      device.gatt.disconnect();
    }
    handlers.onDisconnect(reason);
  };

  const link: GanDriverLink = {
    send: (message) => { if (!closed) write(message).catch(() => {}); },
    disconnect: close,
  };

  const onNotification = (event: Event) => {
    const t = performance.now();
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    const raw = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    if (raw.length < 16) {
      handlers.onTraffic?.({ t, op: 'notify', data: toHex(raw), plain: '', valid: false });
      return;
    }
    const plain = cipher.decrypt(raw);
    const valid = isValidGanGen4Packet(plain);
    handlers.onTraffic?.({ t, op: 'notify', data: toHex(raw), plain: toHex(plain), valid });
    if (!valid) return;
    let events: GanCubeEvent[];
    try {
      events = driver.handleStateEvent(link, plain, t);
    } catch {
      // A corrupt packet that passed the structural check; it stays in the traffic log.
      return;
    }
    events.forEach((e) => handlers.onEvent(e));
  };

  const onGattDisconnected = () => close('the Bluetooth link dropped (gattserverdisconnected)');

  device.addEventListener('gattserverdisconnected', onGattDisconnected);
  stateChar.addEventListener('characteristicvaluechanged', onNotification);
  try {
    await stateChar.startNotifications();
  } catch (error) {
    closed = true;
    device.removeEventListener('gattserverdisconnected', onGattDisconnected);
    stateChar.removeEventListener('characteristicvaluechanged', onNotification);
    server.disconnect();
    throw error;
  }

  return {
    deviceName: device.name ?? 'GAN',
    mac,
    stats: driver.stats,
    sendCommand: (command) => write(driver.createCommandMessage(command)),
    disconnect: () => close('disconnected from the page'),
  };
}
