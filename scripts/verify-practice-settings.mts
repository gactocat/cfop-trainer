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
