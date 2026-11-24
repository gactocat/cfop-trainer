// Run with Node 24:
// node --import ./scripts/register-src-alias.mjs scripts/verify-practice-settings.mts
import assert from 'node:assert/strict';
import type { PracticeSettings } from '@/lib/practice-settings-store';

const sharedKey = 'pll-app:practice-settings:v1';
const defaults: PracticeSettings = { aufDisplay: 'cube', trainerMode: 'standard', randomAuf: true };
const enabled: PracticeSettings = { aufDisplay: 'prefix', trainerMode: 'inverse', randomAuf: false };
const scenarios: { name: string; stored: Record<string, string>; expected: PracticeSettings }[] = [
  { name: 'new user', stored: {}, expected: defaults },
  {
    name: 'F2L wins conflicts, including explicit defaults and false',
    stored: {
      'pll-app:f2l-auf-display:v1': 'cube',
      'pll-app:f2l-trainer-mode:v1': 'standard',
      'pll-app:f2l-scramble-settings:v1': '{"randomAuf":false}',
      'pll-app:oll-trainer-settings:v1': JSON.stringify(enabled),
    },
    expected: { ...defaults, randomAuf: false },
  },
  {
    name: 'OLL fallback merges missing fields from PLL',
    stored: {
      'pll-app:oll-trainer-settings:v1': '{"aufDisplay":"prefix"}',
      'pll-app:pll-trainer-settings:v1': '{"trainerMode":"inverse","randomAuf":false}',
    },
    expected: enabled,
  },
  {
    name: 'invalid legacy values do not hide PLL preferences',
    stored: {
      'pll-app:f2l-auf-display:v1': 'invalid',
      'pll-app:f2l-scramble-settings:v1': 'null',
      'pll-app:oll-trainer-settings:v1': '{',
      'pll-app:pll-trainer-settings:v1': JSON.stringify(enabled),
    },
    expected: enabled,
  },
  {
    name: 'shared settings override all legacy settings',
    stored: { [sharedKey]: JSON.stringify(defaults), 'pll-app:oll-trainer-settings:v1': JSON.stringify(enabled) },
    expected: defaults,
  },
  { name: 'invalid shared fields use defaults', stored: { [sharedKey]: '{"aufDisplay":7,"randomAuf":"false"}' }, expected: defaults },
  { name: 'explicit dark theme survives practice edits', stored: { [sharedKey]: '{"colorTheme":"dark"}' }, expected: { ...defaults, colorTheme: 'dark' } },
  { name: 'invalid theme follows system default', stored: { [sharedKey]: '{"colorTheme":"invalid"}' }, expected: defaults },
];

let moduleId = 0;
const freshStore = async () => {
  const url = new URL('../src/lib/practice-settings-store.ts', import.meta.url);
  url.searchParams.set('scenario', String(moduleId++));
  return await import(url.href) as typeof import('@/lib/practice-settings-store');
};
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
try {
  for (const { name, stored, expected } of scenarios) {
    const values = new Map(Object.entries(stored));
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    } });
    const store = await freshStore();
    assert.deepEqual(store.getServerSnapshot(), defaults, `${name}: deterministic SSR`);
    assert.deepEqual(store.getSnapshot(), expected, name);
    assert.equal(store.getSnapshot(), store.getSnapshot(), `${name}: cached snapshot`);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    store.update({ trainerMode: expected.trainerMode === 'standard' ? 'inverse' : 'standard' });
    assert.equal(notifications, 1, `${name}: subscribers update together`);
    assert.deepEqual(JSON.parse(values.get(sharedKey)!), store.getSnapshot(), `${name}: persistence`);
    assert.deepEqual((await freshStore()).getSnapshot(), store.getSnapshot(), `${name}: reload`);
    for (const [key, value] of Object.entries(stored)) {
      if (key !== sharedKey) assert.equal(values.get(key), value, `${name}: retain old keys`);
    }
    unsubscribe();
  }
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}
console.log(`Verified ${scenarios.length} shared-settings migration, persistence and subscription scenarios.`);

// Practice mode: no setup or with setup, read from the synced trainer mode
// and the device-local no-scramble flag of the three-mode version.
const { choosePracticeMode, practiceModeFrom, storedTrainerMode, trainerFlavor } = await import('@/lib/practice-mode');
const modeReads: [PracticeSettings['trainerMode'], boolean, string][] = [
  ['standard', false, 'no-setup'],
  ['standard', true, 'no-setup'],
  ['inverse', false, 'setup'],
  ['inverse', true, 'no-setup'],
];
for (const [trainerMode, noScramble, expected] of modeReads) {
  assert.equal(practiceModeFrom(trainerMode, noScramble), expected, `${trainerMode}${noScramble ? ' + no-scramble' : ''} reads as ${expected}`);
}
assert.equal(storedTrainerMode('no-setup'), 'standard', 'no setup is stored as standard, which older versions know');
assert.equal(storedTrainerMode('setup'), 'inverse', 'with setup is stored as inverse');
for (const mode of ['no-setup', 'setup'] as const) {
  assert.equal(practiceModeFrom(storedTrainerMode(mode), false), mode, `${mode} survives storing`);
}
assert.equal(trainerFlavor('no-setup', false), 'standard', 'no setup without a cube is the tap timer');
assert.equal(trainerFlavor('no-setup', true), 'no-scramble', 'no setup with a cube is the virtual cube');
assert.equal(trainerFlavor('setup', false), 'inverse', 'with setup without a cube shows the setup');
assert.equal(trainerFlavor('setup', true), 'inverse', 'with setup with a cube guides the setup');

// Data saved by the three-mode version, read through both stores; choosing
// a mode then clears the old flag and keeps the cube's other preferences.
const cubeKey = 'cfop:smart-cube:v1';
const saved = new Map<string, string>([
  [sharedKey, JSON.stringify({ ...defaults, trainerMode: 'inverse' })],
  [cubeKey, JSON.stringify({ holding: 'white-green', macs: {}, noScramble: true, autoAdvance: true, lastCube: null })],
]);
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  },
  addEventListener: () => {},
} });
try {
  const practice = await import('@/lib/practice-settings-store');
  const cube = await import('@/lib/smart-cube-settings-store');
  const current = () => practiceModeFrom(practice.getSnapshot().trainerMode, cube.getSnapshot().noScramble);
  assert.equal(current(), 'no-setup', 'saved no-scramble on top of inverse reads as no setup');
  choosePracticeMode('setup');
  assert.equal(current(), 'setup', 'choosing with setup takes effect');
  assert.equal(JSON.parse(saved.get(sharedKey)!).trainerMode, 'inverse', 'with setup is saved as inverse');
  const cubeSaved = JSON.parse(saved.get(cubeKey)!);
  assert.equal(cubeSaved.noScramble, false, 'the old no-scramble flag is cleared');
  assert.equal(cubeSaved.holding, 'white-green', 'the holding is kept');
  assert.equal(cubeSaved.autoAdvance, true, 'the next-case option is kept');
  choosePracticeMode('no-setup');
  assert.equal(current(), 'no-setup', 'choosing no setup takes effect');
  assert.equal(JSON.parse(saved.get(sharedKey)!).trainerMode, 'standard', 'no setup is saved as standard');
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}
console.log(`Verified ${modeReads.length} practice mode readings, flavors and choosing a mode over saved three-mode data.`);
