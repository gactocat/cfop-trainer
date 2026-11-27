// Checks that ending a smart cube connection ends the Bluetooth link itself,
// so the cube advertises again and other apps can find it: through the real
// store and transports, over stand-in Bluetooth stacks (Web Bluetooth and the
// iOS plugin) that log every call. Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-smart-cube-link.mts
import { register } from 'node:module';

const fakes = new URL('./fakes/', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
  const fakes = {
    '@/lib/native': '${fakes}native.mts',
    '@capacitor-community/bluetooth-le': '${fakes}bluetooth-le.mts',
    'fake:web-bluetooth': '${fakes}web-bluetooth.mts',
  };
  export async function resolve(specifier, context, next) {
    if (specifier in fakes) return { url: fakes[specifier], shortCircuit: true };
    return next(specifier, context);
  }
`)}`);

// The browser globals the store reads.
const events = new EventTarget();
const storage = new Map<string, string>();
let chooserDevice: BluetoothDevice | null = null;
Object.assign(globalThis, {
  window: globalThis,
  isSecureContext: true,
  document: { hidden: false },
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
  dispatchEvent: events.dispatchEvent.bind(events),
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    maxTouchPoints: 0,
    bluetooth: {
      requestDevice: async () => {
        if (!chooserDevice) throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError');
        return chooserDevice;
      },
    },
  },
});
const native = (on: boolean) => { (globalThis as { __cfopNative?: boolean }).__cfopNative = on; };

const load = (specifier: string) => import(specifier);
const store = await import('@/lib/smart-cube-store');
const settings = await import('@/lib/smart-cube-settings-store');
const testCube = await import('@/lib/test-cube-store');
const { TEST_CUBE_MAC } = await import('@/lib/smart-cube/test-cube');
const { fakeWebCube } = await load('fake:web-bluetooth') as typeof import('./fakes/web-bluetooth.mjs');
const ble = await load('@capacitor-community/bluetooth-le') as typeof import('./fakes/bluetooth-le.mjs');

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function until(condition: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) return false;
    await delay(5);
  }
  return true;
}
const ready = () => until(() => store.getSnapshot().status === 'connected' && store.getSnapshot().state !== null);
const idle = () => until(() => store.getSnapshot().status === 'idle');
/** Long enough for the store's heartbeat (each second) and the cube's keepalive to run if anything was left. */
const SETTLE_MS = 1500;
const timers = () => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
const show = (log: string[]) => log.join(', ') || '(none)';

// --- browser (Web Bluetooth)
native(false);

{
  const cube = fakeWebCube();
  chooserDevice = cube.device;
  await store.connect(TEST_CUBE_MAC);
  check('web: the cube connects', await ready(), store.getSnapshot().status);
  check('web: a linked cube does not advertise', !cube.advertising);
  cube.log.length = 0;
  store.disconnect();
  check('web: Disconnect shows no cube at once', store.getSnapshot().status === 'idle' && store.getSnapshot().problem === null);
  check('web: Disconnect ends the GATT link', await until(() => !cube.connected), show(cube.log));
  check('web: notifications stop before the link ends',
    show(cube.log) === 'stopNotifications, stopNotifications done, disconnect', show(cube.log));
  const after = cube.log.length;
  await delay(SETTLE_MS);
  check('web: nothing reconnects or writes after Disconnect', cube.log.length === after, show(cube.log.slice(after)));
  check('web: the cube advertises again', cube.advertising);
  check('web: no timer is left running', timers() === 0, `${timers()} timers`);
}

{
  // A cube that no longer answers the stop: the link must still end.
  const cube = fakeWebCube();
  chooserDevice = cube.device;
  await store.connect(TEST_CUBE_MAC);
  await ready();
  cube.stopHangs = true;
  cube.log.length = 0;
  const started = Date.now();
  store.disconnect();
  check('web: the link ends when the stop never answers', await until(() => !cube.connected, 3000), show(cube.log));
  check('web: ... within about a second', Date.now() - started < 1500, `${Date.now() - started} ms`);
}

{
  // Connecting again at once: the old link's end must not end the new one.
  const cube = fakeWebCube();
  chooserDevice = cube.device;
  await store.connect(TEST_CUBE_MAC);
  await ready();
  cube.log.length = 0;
  store.disconnect();
  void store.connect(TEST_CUBE_MAC);
  check('web: connecting again at once connects', await ready(), store.getSnapshot().status);
  await delay(200);
  check('web: ... and stays linked', cube.connected && store.getSnapshot().status === 'connected', show(cube.log));
  check('web: ... the old link ended before the new one began',
    cube.log.indexOf('disconnect') !== -1 && cube.log.indexOf('disconnect') < cube.log.lastIndexOf('connect'), show(cube.log));
  store.disconnect();
  await until(() => !cube.connected);
}

{
  // A cube gone quiet: the store gives up and must release the link too.
  const cube = fakeWebCube();
  chooserDevice = cube.device;
  await store.connect(TEST_CUBE_MAC);
  await ready();
  cube.log.length = 0;
  cube.silence();
  check('web: a silent cube counts as lost', await until(() => store.getSnapshot().problem === 'lost', 5000), store.getSnapshot().status);
  check('web: ... and its link ends', await until(() => !cube.connected), show(cube.log));
}

{
  // The test cube replaces a real one, and the other way round.
  const cube = fakeWebCube();
  chooserDevice = cube.device;
  await store.connect(TEST_CUBE_MAC);
  await ready();
  await testCube.connectTestCube();
  check('web: the test cube connects in place of the real one', await ready() && store.getSnapshot().virtual);
  check('web: ... and the real cube is released', await until(() => !cube.connected), show(cube.log));
  cube.log.length = 0;
  await store.connect(TEST_CUBE_MAC);
  check('web: a real cube connects in place of the test cube', await ready() && !store.getSnapshot().virtual && cube.connected);
  store.disconnect();
  check('web: ... and is released by Disconnect', await until(() => !cube.connected), show(cube.log));
  await idle();
}

// --- iOS app (Capacitor Bluetooth plugin)
native(true);
chooserDevice = null;
settings.rememberMac(ble.FAKE_DEVICE_NAME, TEST_CUBE_MAC);
settings.rememberLastCube(ble.FAKE_DEVICE_ID, ble.FAKE_DEVICE_NAME);

{
  ble.resetFakeBle();
  await store.connectLast();
  check('app: the last cube connects', await ready(), store.getSnapshot().status);
  ble.fakeBle.log.length = 0;
  store.disconnect();
  check('app: Disconnect ends the link', await until(() => !ble.fakeBle.connected), show(ble.fakeBle.log));
  check('app: notifications stop before the link ends',
    show(ble.fakeBle.log) === 'stopNotifications, stopNotifications done, disconnect', show(ble.fakeBle.log));
  const after = ble.fakeBle.log.length;
  await delay(SETTLE_MS);
  check('app: nothing reconnects or writes after Disconnect', ble.fakeBle.log.length === after, show(ble.fakeBle.log.slice(after)));
  check('app: no timer is left running', timers() === 0, `${timers()} timers`);
}

{
  ble.resetFakeBle();
  await store.connectLast();
  await ready();
  ble.fakeBle.stopFails = true;
  store.disconnect();
  check('app: the link ends when the stop fails', await until(() => !ble.fakeBle.connected), show(ble.fakeBle.log));
}

{
  ble.resetFakeBle();
  await store.connectLast();
  await ready();
  ble.fakeBle.log.length = 0;
  store.disconnect();
  void store.connectLast();
  check('app: connecting again at once connects', await ready(), store.getSnapshot().status);
  await delay(200);
  check('app: ... and stays linked', ble.fakeBle.connected && store.getSnapshot().status === 'connected', show(ble.fakeBle.log));
  store.disconnect();
  await until(() => !ble.fakeBle.connected);
  await idle();
}

{
  // The web view was reloaded (iOS ends its process, for one) while a cube was
  // connected: the plugin outlives the page and still holds the link, which
  // this page knows nothing of.
  ble.resetFakeBle({ leftover: true });
  await store.releaseLeftoverCubes();
  check('app: a link left by an earlier page is released at start', !ble.fakeBle.connected, show(ble.fakeBle.log));
  check('app: ... without setting Bluetooth up again (no permission prompt)', !ble.fakeBle.log.includes('initialize'), show(ble.fakeBle.log));

  // A fresh launch: nothing set up, nothing to release, and no prompt either.
  ble.resetFakeBle();
  await store.releaseLeftoverCubes();
  check('app: a fresh launch releases nothing and asks nothing', !ble.fakeBle.log.includes('initialize') && !ble.fakeBle.log.includes('disconnect'), show(ble.fakeBle.log));

  // This page's own connection is not a leftover.
  ble.resetFakeBle();
  await store.connectLast();
  await ready();
  await store.releaseLeftoverCubes();
  check('app: the page\'s own cube stays connected', ble.fakeBle.connected && store.getSnapshot().status === 'connected', show(ble.fakeBle.log));
  store.disconnect();
  await until(() => !ble.fakeBle.connected);
}

await delay(50);
if (failures > 0) {
  console.error(`${failures} of ${checks} check(s) failed`);
  process.exit(1);
}
console.log(`All ${checks} smart cube link checks passed`);
process.exit(0);
