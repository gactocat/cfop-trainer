// Stand-in for @capacitor-community/bluetooth-le in the checks: the parts of
// BleClient the iOS transport uses, over one test cube. Like the real client
// it runs its calls one at a time, in order. `fakeBle` lets a check see the
// calls and the link, and set up a link left over from an earlier page.
import { TestCube } from '@/lib/smart-cube/test-cube';

export interface FakeBleState {
  /** Calls in order, with "<call> done" when one that takes a while finishes. */
  log: string[];
  /** Whether the cube is linked to this app (CoreBluetooth's state for the peripheral). */
  connected: boolean;
  /** The plugin was set up by a page before this one (it outlives the web view). */
  managerAlive: boolean;
  /** stopNotifications fails, as the plugin's timeout makes it when the cube does not answer. */
  stopFails: boolean;
  cube: TestCube;
}

export const FAKE_DEVICE_ID = 'FAKE-CUBE-1';
export const FAKE_DEVICE_NAME = 'GAN12 ui fake';

export const fakeBle: FakeBleState = { log: [], connected: false, managerAlive: false, stopFails: false, cube: new TestCube() };

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let tail: Promise<unknown> = Promise.resolve();
const queue = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = tail.then(fn);
  tail = run.catch(() => {});
  return run;
};

let link: ReturnType<TestCube['attach']> | null = null;
let onDisconnect: ((deviceId: string) => void) | null = null;

function requireLink(deviceId: string) {
  if (deviceId !== FAKE_DEVICE_ID) throw new Error('Device not found.');
  if (!fakeBle.connected) throw new Error('Not connected to device.');
}

function dropLink() {
  fakeBle.connected = false;
  link?.detach();
  link = null;
  // The plugin reports the end of the link, ours included (didDisconnectPeripheral).
  const callback = onDisconnect;
  onDisconnect = null;
  callback?.(FAKE_DEVICE_ID);
}

/** Reset between checks; `leftover` leaves the cube linked as a page before this one would have. */
export function resetFakeBle({ leftover = false } = {}) {
  fakeBle.log = [];
  fakeBle.stopFails = false;
  link?.detach();
  link = null;
  onDisconnect = null;
  fakeBle.cube = new TestCube();
  fakeBle.connected = leftover;
  fakeBle.managerAlive = leftover;
}

const props = (write: boolean, notify: boolean) => ({
  broadcast: false, read: false, writeWithoutResponse: false, write, notify, indicate: false,
  authenticatedSignedWrites: false, extendedProperties: false,
});

export const BleClient = {
  initialize: () => queue(async () => { fakeBle.log.push('initialize'); fakeBle.managerAlive = true; }),
  isEnabled: () => queue(async () => true),
  openAppSettings: async () => {},
  requestLEScan: () => queue(async () => {}),
  stopLEScan: () => queue(async () => {}),
  getDevices: (ids: string[]) => queue(async () => ids.filter((id) => id === FAKE_DEVICE_ID).map((deviceId) => ({ deviceId, name: FAKE_DEVICE_NAME }))),
  getConnectedDevices: () => queue(async () => {
    fakeBle.log.push('getConnectedDevices');
    if (!fakeBle.managerAlive) throw new Error('Bluetooth LE not initialized.');
    return fakeBle.connected ? [{ deviceId: FAKE_DEVICE_ID, name: FAKE_DEVICE_NAME }] : [];
  }),
  connect: (deviceId: string, disconnected?: (deviceId: string) => void) => queue(async () => {
    fakeBle.log.push('connect');
    if (deviceId !== FAKE_DEVICE_ID) throw new Error('Device not found.');
    await delay(10);
    fakeBle.connected = true;
    onDisconnect = disconnected ?? null;
  }),
  getServices: (deviceId: string) => queue(async () => {
    requireLink(deviceId);
    return [{
      uuid: '00000010-0000-fff7-fff6-fff5fff4fff0',
      characteristics: [
        { uuid: '0000fff5-0000-1000-8000-00805f9b34fb', properties: props(true, false), descriptors: [] },
        { uuid: '0000fff6-0000-1000-8000-00805f9b34fb', properties: props(false, true), descriptors: [] },
      ],
    }];
  }),
  write: (deviceId: string, _service: string, _characteristic: string, value: DataView) => queue(async () => {
    requireLink(deviceId);
    fakeBle.log.push('write');
    link?.write(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }),
  writeWithoutResponse: (deviceId: string, service: string, characteristic: string, value: DataView) =>
    BleClient.write(deviceId, service, characteristic, value),
  startNotifications: (deviceId: string, _service: string, _characteristic: string, callback: (value: DataView) => void) => queue(async () => {
    requireLink(deviceId);
    fakeBle.log.push('startNotifications');
    link = fakeBle.cube.attach((raw) => callback(new DataView(raw.buffer, raw.byteOffset, raw.byteLength)));
  }),
  stopNotifications: (deviceId: string) => queue(async () => {
    requireLink(deviceId);
    fakeBle.log.push('stopNotifications');
    await delay(30);
    if (fakeBle.stopFails) throw new Error('Set notifications timeout.');
    link?.detach();
    link = null;
    fakeBle.log.push('stopNotifications done');
  }),
  disconnect: (deviceId: string) => queue(async () => {
    fakeBle.log.push('disconnect');
    if (deviceId !== FAKE_DEVICE_ID) throw new Error('Device not found.');
    if (fakeBle.connected) dropLink();
  }),
};
