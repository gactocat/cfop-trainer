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
  { name: 'aligned AUF survives', stored: { [sharedKey]: '{"randomAuf":false,"alignAuf":true}' }, expected: { ...defaults, randomAuf: false, alignAuf: true } },
  { name: 'invalid aligned AUF is ignored', stored: { [sharedKey]: '{"alignAuf":"yes"}' }, expected: defaults },
  { name: 'measuring recognition survives', stored: { [sharedKey]: '{"measureRecognition":true}' }, expected: { ...defaults, measureRecognition: true } },
  { name: 'recognition off is no field', stored: { [sharedKey]: '{"measureRecognition":false}' }, expected: defaults },
  { name: 'invalid recognition choice is off', stored: { [sharedKey]: '{"measureRecognition":"yes"}' }, expected: defaults },
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

// Each list's AUF display: it starts from the one shared choice, is changed
// list by list, and survives older versions, which know only the shared one.
{
  const lists = ['f2l', 'oll', 'pll'] as const;
  const displays = (store: typeof import('@/lib/practice-settings-store')) =>
    Object.fromEntries(lists.map((list) => [list, store.aufDisplayOf(store.getSnapshot(), list)]));
  const all = (display: 'cube' | 'prefix') => ({ f2l: display, oll: display, pll: display });
  const reads: { name: string; stored: Record<string, string>; expected: Record<string, string> }[] = [
    { name: 'new user: every list on cube', stored: {}, expected: all('cube') },
    { name: 'the shared choice is every list\'s first value', stored: { [sharedKey]: '{"aufDisplay":"prefix"}' }, expected: all('prefix') },
    {
      name: 'pre-shared F2L preference still seeds every list',
      stored: { 'pll-app:f2l-auf-display:v1': 'prefix', 'pll-app:pll-trainer-settings:v1': '{"aufDisplay":"cube"}' },
      expected: all('prefix'),
    },
    {
      name: 'a list with its own choice keeps it; the others follow the shared one',
      stored: { [sharedKey]: '{"aufDisplay":"prefix","aufDisplays":{"pll":"cube"}}' },
      expected: { f2l: 'prefix', oll: 'prefix', pll: 'cube' },
    },
    {
      name: 'invalid list choices are ignored',
      stored: { [sharedKey]: '{"aufDisplay":"cube","aufDisplays":{"f2l":"sideways","oll":"prefix","zbll":"prefix"}}' },
      expected: { f2l: 'cube', oll: 'prefix', pll: 'cube' },
    },
    { name: 'a malformed list map is ignored', stored: { [sharedKey]: '{"aufDisplay":"prefix","aufDisplays":"cube"}' }, expected: all('prefix') },
  ];
  for (const { name, stored, expected } of reads) {
    const values = new Map(Object.entries(stored));
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    } });
    const store = await freshStore();
    assert.deepEqual(displays(store), expected, name);
  }

  // Changing one list from the shared choice, then an older version saving.
  const values = new Map<string, string>([[sharedKey, JSON.stringify({ ...defaults, aufDisplay: 'prefix', colorTheme: 'dark' })]]);
  let writes = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { writes++; values.set(key, value); },
    },
  } });
  const store = await freshStore();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.setAufDisplay('pll', 'prefix');
  assert.equal(writes + notifications, 0, 'choosing what a list already shows writes nothing');
  store.setAufDisplay('oll', 'cube');
  assert.equal(notifications, 1, 'a list change notifies once');
  assert.deepEqual(displays(store), { f2l: 'prefix', oll: 'cube', pll: 'prefix' }, 'only that list changes');
  let saved = JSON.parse(values.get(sharedKey)!);
  assert.equal(saved.aufDisplay, 'prefix', 'the shared choice, which older versions use, is kept');
  assert.equal(saved.colorTheme, 'dark', 'other settings are kept');
  assert.deepEqual(saved.aufDisplays, { oll: 'cube' }, 'the list choice is saved in the synced settings');
  store.setAufDisplay('pll', 'cube');
  store.setAufDisplay('oll', 'prefix');
  assert.deepEqual(displays(await freshStore()), { f2l: 'prefix', oll: 'prefix', pll: 'cube' }, 'list choices survive a reload');
  store.update({ trainerMode: 'inverse' });
  assert.deepEqual(JSON.parse(values.get(sharedKey)!).aufDisplays, { oll: 'prefix', pll: 'cube' }, 'other edits keep the list choices');
  unsubscribe();

  // The theme: light or dark is kept as chosen; the system's is no choice,
  // which older versions (keeping only light and dark) read the same way.
  store.update({ colorTheme: 'light' });
  assert.equal(JSON.parse(values.get(sharedKey)!).colorTheme, 'light', 'a chosen theme is saved');
  store.update({ colorTheme: undefined });
  assert.equal('colorTheme' in JSON.parse(values.get(sharedKey)!), false, 'the system theme is saved as no choice');
  assert.equal((await freshStore()).getSnapshot().colorTheme, undefined, 'and read back as the system theme');
  store.update({ colorTheme: 'dark' });

  // An older version reads the shared fields it knows and, saving, keeps
  // only those (as its validSettings does).
  saved = JSON.parse(values.get(sharedKey)!);
  const olderKnown = ['aufDisplay', 'trainerMode', 'randomAuf', 'alignAuf', 'colorTheme'];
  const older = Object.fromEntries(Object.entries(saved).filter(([key]) => olderKnown.includes(key)));
  assert.equal(older.aufDisplay, 'prefix', 'older versions still read a valid shared AUF display');
  values.set(sharedKey, JSON.stringify({ ...older, aufDisplay: 'cube' }));
  assert.deepEqual(displays(await freshStore()), all('cube'), 'after an older version saves, every list follows its choice again');
}
if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
else Reflect.deleteProperty(globalThis, 'window');
console.log('Verified per-list AUF display: inheritance, list changes, persistence and older versions.');

// Measuring recognition: off by default, saved only when on, and turned off
// again by an older version saving (it keeps only the fields it knows).
{
  const values = new Map<string, string>([[sharedKey, JSON.stringify({ ...defaults, colorTheme: 'dark' })]]);
  let writes = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { writes++; values.set(key, value); },
    },
  } });
  const store = await freshStore();
  assert.equal(store.getSnapshot().measureRecognition, undefined, 'recognition is not measured by default');
  store.setMeasureRecognition(false);
  assert.equal(writes, 0, 'turning off what is off writes nothing');
  store.setMeasureRecognition(true);
  assert.deepEqual(JSON.parse(values.get(sharedKey)!), { ...defaults, colorTheme: 'dark', measureRecognition: true }, 'on is saved in the synced settings, the rest kept');
  assert.equal((await freshStore()).getSnapshot().measureRecognition, true, 'on survives a reload');
  store.update({ trainerMode: 'inverse' });
  assert.equal(JSON.parse(values.get(sharedKey)!).measureRecognition, true, 'other edits keep it');
  store.setMeasureRecognition(false);
  assert.equal('measureRecognition' in JSON.parse(values.get(sharedKey)!), false, 'off takes the field away');
  store.setMeasureRecognition(true);
  const olderKnown = ['aufDisplay', 'trainerMode', 'randomAuf', 'alignAuf', 'colorTheme', 'aufDisplays', 'solves'];
  const older = Object.fromEntries(Object.entries(JSON.parse(values.get(sharedKey)!)).filter(([key]) => olderKnown.includes(key)));
  values.set(sharedKey, JSON.stringify(older));
  const reread = (await freshStore()).getSnapshot();
  assert.equal(reread.measureRecognition, undefined, 'after an older version saves, recognition is off again');
  assert.equal(reread.trainerMode, 'inverse', 'and the settings it knows are as it left them');
}
if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
else Reflect.deleteProperty(globalThis, 'window');
console.log('Verified measuring recognition: default, saving, reload and older versions.');

// Practice mode: no setup or with setup, read from the synced trainer mode
// and the device-local no-scramble flag of the three-mode version.
const { choosePracticeMode, practiceModeFrom, storedTrainerMode, timesRecognition, trainerFlavor } = await import('@/lib/practice-mode');
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
assert.equal(trainerFlavor('setup', true), 'smart-setup', 'with setup with a cube is guided and recorded by the cube');
// Recognition is timed only on a smart cube; without one the choice waits.
assert.equal(timesRecognition('no-scramble', true), true, 'chosen, no setup on a cube: timed');
assert.equal(timesRecognition('smart-setup', true), true, 'chosen, with setup on a cube: timed');
assert.equal(timesRecognition('standard', true), false, 'chosen, no cube and no setup: not timed');
assert.equal(timesRecognition('inverse', true), false, 'chosen, no cube with setup: not timed');
for (const flavor of ['standard', 'inverse', 'no-scramble', 'smart-setup'] as const) {
  assert.equal(timesRecognition(flavor, false), false, `not chosen: never timed (${flavor})`);
}

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
  assert.equal('autoAdvance' in cubeSaved, false, 'the old next-case option is no longer read, and dropped when saved');
  choosePracticeMode('no-setup');
  assert.equal(current(), 'no-setup', 'choosing no setup takes effect');
  assert.equal(JSON.parse(saved.get(sharedKey)!).trainerMode, 'standard', 'no setup is saved as standard');
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}
console.log(`Verified ${modeReads.length} practice mode readings, flavors and choosing a mode over saved three-mode data.`);

// Solve settings: the scramble's holding, read from what this version and
// older ones save. Older versions kept one holding for both the scramble and
// the solve (`top` and `front`), and one kept a `cross` colour beside it,
// which is not read and is left out when the settings are saved.
{
  const solveReads: { name: string; cfop: unknown; expected: object }[] = [
    { name: 'nothing saved: WCA scramble', cfop: undefined, expected: { top: 'white', front: 'green', inspection: true } },
    { name: 'an older holding is the scramble\'s', cfop: { top: 'yellow', front: 'blue', inspection: false }, expected: { top: 'yellow', front: 'blue', inspection: false } },
    { name: 'a saved cross colour is ignored', cfop: { top: 'white', front: 'red', cross: 'yellow', inspection: true }, expected: { top: 'white', front: 'red', inspection: true } },
    { name: 'a front that does not fit drops the holding only', cfop: { top: 'white', front: 'yellow', inspection: false }, expected: { top: 'white', front: 'green', inspection: false } },
  ];
  for (const { name, cfop, expected } of solveReads) {
    const values = new Map<string, string>(cfop === undefined ? [] : [[sharedKey, JSON.stringify({ ...defaults, solves: { cfop } })]]);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    } });
    const store = await freshStore();
    assert.deepEqual(store.solveSettingsOf(store.getSnapshot(), 'cfop'), expected, `solve settings: ${name}`);
  }
  // Saving over a cross colour leaves it out and keeps the holding.
  const values = new Map<string, string>([[sharedKey, JSON.stringify({ ...defaults, solves: { cfop: { top: 'yellow', front: 'green', cross: 'blue', inspection: true } } })]]);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  } });
  const store = await freshStore();
  store.setSolveSettings('cfop', store.solveSettingsOf(store.getSnapshot(), 'cfop'), { inspection: false });
  assert.deepEqual(JSON.parse(values.get(sharedKey)!).solves.cfop, { top: 'yellow', front: 'green', inspection: false }, 'saving leaves a cross colour out');
  store.setSolveSettings('cfop', store.solveSettingsOf(store.getSnapshot(), 'cfop'), { top: 'green' });
  assert.deepEqual(JSON.parse(values.get(sharedKey)!).solves.cfop, { top: 'green', front: 'white', inspection: false }, 'a top that no longer fits the front moves the front');
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  console.log(`Verified ${solveReads.length} solve settings readings, a saved cross colour ignored and left out.`);
}

// The head script that sets the theme and language before the first paint.
const { DISPLAY_INIT_SCRIPT } = await import('@/lib/display-init-script');
const { DISPLAY_HINT_KEY } = await import('@/lib/display-hint');
const runInit = (stored: Record<string, string> | 'throws', systemDark: boolean, language: string) => {
  const attributes = new Map<string, string>();
  const html = {
    lang: 'en',
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    removeAttribute: (name: string) => { attributes.delete(name); },
  };
  const storage = {
    getItem: (key: string) => {
      if (stored === 'throws') throw new Error('blocked');
      return stored[key] ?? null;
    },
  };
  const timers: (() => void)[] = [];
  new Function('document', 'localStorage', 'window', 'navigator', 'setTimeout', DISPLAY_INIT_SCRIPT)(
    { documentElement: html }, storage, { matchMedia: () => ({ matches: systemDark }) }, { language },
    (callback: () => void) => { timers.push(callback); },
  );
  const result = { theme: attributes.get('data-theme'), lang: html.lang, pending: attributes.has('data-locale-pending') };
  timers.forEach((callback) => callback());
  return { ...result, pendingAfterTimeout: attributes.has('data-locale-pending') };
};
const guestSettings = (colorTheme: string) => JSON.stringify({ ...defaults, colorTheme });
const initCases: { name: string; stored: Record<string, string> | 'throws'; systemDark: boolean; language: string; theme: string; lang: string }[] = [
  { name: 'hint wins over the system and the browser', stored: { [DISPLAY_HINT_KEY]: '{"theme":"dark","locale":"ja"}' }, systemDark: false, language: 'en-US', theme: 'dark', lang: 'ja' },
  { name: 'hint "system" follows the system', stored: { [DISPLAY_HINT_KEY]: '{"theme":"system","locale":"en"}' }, systemDark: true, language: 'ja-JP', theme: 'dark', lang: 'en' },
  { name: 'guest settings before any hint', stored: { [sharedKey]: guestSettings('light'), 'pll-app:locale:v1': 'en' }, systemDark: true, language: 'ja-JP', theme: 'light', lang: 'en' },
  { name: 'nothing saved: system dark, Japanese browser', stored: {}, systemDark: true, language: 'ja-JP', theme: 'dark', lang: 'ja' },
  { name: 'nothing saved: system light, English browser', stored: {}, systemDark: false, language: 'en-US', theme: 'light', lang: 'en' },
  { name: 'unreadable hint falls back', stored: { [DISPLAY_HINT_KEY]: '{', 'pll-app:locale:v1': 'ja' }, systemDark: false, language: 'en-US', theme: 'light', lang: 'ja' },
  { name: 'blocked storage falls back to the system and the browser', stored: 'throws', systemDark: true, language: 'ja', theme: 'dark', lang: 'ja' },
];
for (const c of initCases) {
  const result = runInit(c.stored, c.systemDark, c.language);
  assert.equal(result.theme, c.theme, `${c.name}: theme`);
  assert.equal(result.lang, c.lang, `${c.name}: lang`);
  assert.equal(result.pending, c.lang !== 'en', `${c.name}: prerendered English hidden only for another language`);
  assert.equal(result.pendingAfterTimeout, false, `${c.name}: never hidden for good`);
}
console.log(`Verified ${initCases.length} first-paint theme and language decisions.`);
