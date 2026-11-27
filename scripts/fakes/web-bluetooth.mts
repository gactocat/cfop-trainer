/// <reference types="web-bluetooth" />
// A Web Bluetooth device in the checks: the GATT calls the browser transport
// makes, over one test cube, logged in order. `advertising` follows the link
// as a GAN cube's does: a linked cube does not advertise, so no other app
// can find it.
import { TestCube } from '@/lib/smart-cube/test-cube';

export interface FakeWebCube {
  device: BluetoothDevice;
  log: string[];
  readonly connected: boolean;
  readonly advertising: boolean;
  cube: TestCube;
  /** stopNotifications never answers (a cube that no longer replies). */
  stopHangs: boolean;
  /** The cube stops sending, as one that has gone out of range does before the link times out. */
  silence(): void;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function fakeWebCube(name = 'GAN12 ui fake'): FakeWebCube {
  const log: string[] = [];
  const cube = new TestCube();
  let connected = false;
  let link: ReturnType<TestCube['attach']> | null = null;
  const device = new EventTarget() as EventTarget & { name: string; id: string; gatt: unknown };
  const state = new EventTarget() as EventTarget & Record<string, unknown>;
  const command = new EventTarget() as EventTarget & Record<string, unknown>;
  const fake: FakeWebCube = {
    device: device as unknown as BluetoothDevice,
    log,
    get connected() { return connected; },
    get advertising() { return !connected; },
    cube,
    stopHangs: false,
    silence: () => { link?.detach(); },
  };

  const requireLink = () => {
    if (!connected) throw new DOMException('GATT Server is disconnected. Cannot perform GATT operations.', 'NetworkError');
  };
  const dropLink = () => {
    connected = false;
    link?.detach();
    link = null;
  };

  Object.assign(state, {
    uuid: '0000fff6-0000-1000-8000-00805f9b34fb',
    properties: { notify: true, write: false, writeWithoutResponse: false },
    value: null as DataView | null,
    startNotifications: async () => {
      requireLink();
      log.push('startNotifications');
      link = cube.attach((raw) => {
        state.value = new DataView(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
        state.dispatchEvent(new Event('characteristicvaluechanged'));
      });
      return state;
    },
    stopNotifications: async () => {
      requireLink();
      log.push('stopNotifications');
      if (fake.stopHangs) await new Promise(() => {});
      await delay(30);
      // The browser fails a stop that the link's end overtakes.
      requireLink();
      link?.detach();
      link = null;
      log.push('stopNotifications done');
      return state;
    },
  });
  Object.assign(command, {
    uuid: '0000fff5-0000-1000-8000-00805f9b34fb',
    properties: { notify: false, write: true, writeWithoutResponse: false },
    writeValueWithResponse: async (data: BufferSource) => {
      requireLink();
      log.push('write');
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
      link?.write(bytes);
    },
  });
  const service = {
    uuid: '00000010-0000-fff7-fff6-fff5fff4fff0',
    getCharacteristic: async (uuid: string) => {
      requireLink();
      if (uuid === state.uuid) return state;
      if (uuid === command.uuid) return command;
      throw new DOMException('No Characteristics matching UUID found in Service.', 'NotFoundError');
    },
  };
  const gatt = {
    device,
    get connected() { return connected; },
    connect: async () => {
      log.push('connect');
      await delay(10);
      connected = true;
      return gatt;
    },
    disconnect: () => {
      log.push('disconnect');
      if (!connected) return;
      dropLink();
      device.dispatchEvent(new Event('gattserverdisconnected'));
    },
    getPrimaryService: async (uuid: string) => {
      requireLink();
      if (uuid === service.uuid) return service;
      throw new DOMException('No Services matching UUID found in Device.', 'NotFoundError');
    },
  };
  Object.assign(device, { name, id: 'fake-web-cube', gatt });
  return fake;
}
