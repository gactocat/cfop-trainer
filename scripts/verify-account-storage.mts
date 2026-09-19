// Run with Node 24 and scripts/register-src-alias.mjs.
import assert from 'node:assert/strict';
import {
  activateAccountStorage, activateGuestStorage, canWriteData, getPersistenceSnapshot,
  initializeAccount, lockSession, readStoredValue, reloadAccount, retryAccountSave,
  setStorageOnline, type AccountBackend,
} from '@/lib/persistence';
import { createLocalStore } from '@/lib/local-store';
import { createSelectionPresetsStore } from '@/lib/selection-presets-store';
import { getSnapshot as getLocale, setLocale } from '@/lib/locale-store';
import type { AccountData } from '@/lib/account-data';
import { parseAccountData } from '@/lib/account-data';

const guest = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: { getItem: (key: string) => guest.get(key) ?? null, setItem: (key: string, value: string) => guest.set(key, value) },
} });
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const key = 'pll-app:random-solves:v1';
const store = createLocalStore<number[]>(key, [], (raw) => raw as number[]);
const presets = createSelectionPresetsStore('pll-app:pll-selection-presets:v1', (id): id is string => typeof id === 'string');
let server: { data: AccountData; revision: number; writeId: string } | null = null;
let fail = false;
let loseResponse = false;
let saveCount = 0;
const expectedUsers: string[] = [];
let hold: (() => Promise<void>) | null = null;
const backend: AccountBackend = {
  load: async () => server && { data: { ...server.data }, revision: server.revision },
  save: async (data, revision, writeId, expectedUserId) => {
    saveCount++;
    expectedUsers.push(expectedUserId);
    if (hold) await hold();
    if (fail) throw new Error('Network failure');
    if (server?.writeId === writeId) return server.revision;
    if ((server?.revision ?? 0) !== revision) throw { code: 'PT409' };
    server = { data: { ...data }, revision: revision + 1, writeId };
    if (loseResponse) { loseResponse = false; throw new Error('Lost response'); }
    return server.revision;
  },
};

activateGuestStorage();
setStorageOnline(false);
store.mutate(() => [1]);
setLocale('ja');
presets.save('Guest set', ['Aa']);
assert.equal(guest.get(key), '[1]');
assert.equal(getLocale(), 'ja');
assert.equal(presets.getSnapshot().length, 1);
const originalGuest = new Map(guest);
setStorageOnline(true);
await activateAccountStorage('user-a', 'a@example.test', backend);
assert.equal(getPersistenceSnapshot().mode, 'choice');
assert.deepEqual(store.getSnapshot(), []);
assert.equal(presets.getSnapshot().length, 0);
assert.equal(canWriteData(), false);
await initializeAccount(true);
assert.equal(getPersistenceSnapshot().mode, 'account');
assert.deepEqual(store.getSnapshot(), [1]);
assert.equal(getLocale(), 'ja');
assert.equal(presets.getSnapshot().length, 1);
store.mutate((values) => [...values, 2]);
setLocale('en');
await tick();
assert.equal(server!.data[key], '[1,2]');
assert.equal(server!.data['pll-app:locale:v1'], 'en');
assert.deepEqual(guest, originalGuest, 'account changes never touch guest data');

setStorageOnline(false);
assert.equal(canWriteData(), false);
assert.throws(() => store.mutate(() => [999]), /read-only/);
assert.deepEqual(store.getSnapshot(), [1, 2]);
setStorageOnline(true);

// A lost response retries the same write id and does not duplicate the commit.
loseResponse = true;
store.mutate((values) => [...values, 3]);
await tick();
const committedRevision = server!.revision;
assert.equal(getPersistenceSnapshot().error, 'save');
assert.equal(getPersistenceSnapshot().dirty, true);
retryAccountSave();
await tick();
assert.equal(server!.revision, committedRevision);
assert.equal(getPersistenceSnapshot().dirty, false);

// Updates during an in-flight request are serialized after it.
let release!: () => void;
hold = () => new Promise<void>((resolve) => { release = resolve; });
store.mutate(() => [4]);
await tick();
store.mutate(() => [4, 5]);
hold = null;
release();
await tick();
assert.equal(server!.data[key], '[4,5]');
assert.equal(getPersistenceSnapshot().dirty, false);

// A concurrent device write is never silently replaced.
server!.revision++;
server!.writeId = crypto.randomUUID();
server!.data[key] = '[10]';
store.mutate(() => [6]);
await tick();
assert.equal(getPersistenceSnapshot().error, 'conflict');
assert.equal(server!.data[key], '[10]');
await reloadAccount();
assert.deepEqual(store.getSnapshot(), [10]);
assert.equal(getPersistenceSnapshot().dirty, false);

// A late response from a previous account cannot rehydrate its data.
hold = () => new Promise<void>((resolve) => { release = resolve; });
store.mutate(() => [11]);
await tick();
activateGuestStorage();
hold = null;
release();
await tick();
assert.equal(getPersistenceSnapshot().mode, 'guest');
assert.equal(expectedUsers.at(-1), 'user-a', 'in-flight writes stay bound to the original account');
assert.deepEqual(store.getSnapshot(), [1]);
assert.equal(getLocale(), 'ja');
assert.equal(presets.getSnapshot().length, 1);
assert.deepEqual(guest, originalGuest);

// Existing accounts always load the server copy, never import guest state.
await activateAccountStorage('user-a', 'a@example.test', backend);
assert.equal(getPersistenceSnapshot().mode, 'account');
assert.deepEqual(store.getSnapshot(), [11]);
lockSession();
assert.equal(readStoredValue(key), null);
assert.equal(canWriteData(), false);
assert.deepEqual(store.getSnapshot(), []);

// Fresh accounts begin empty. A failed initial import is retryable and atomic.
activateGuestStorage();
server = null;
await activateAccountStorage('user-b', 'b@example.test', backend);
fail = true;
await initializeAccount(false);
assert.equal(getPersistenceSnapshot().error, 'save');
assert.equal(server, null);
fail = false;
retryAccountSave();
await tick();
assert.equal(getPersistenceSnapshot().mode, 'account');
assert.deepEqual(store.getSnapshot(), []);
assert.deepEqual(guest, originalGuest);
// Failed reads cannot fall back to a guest document or enable writes.
activateGuestStorage();
await activateAccountStorage('user-c', 'c@example.test', {
  ...backend, load: async () => { throw new Error('Cannot load'); },
});
assert.equal(getPersistenceSnapshot().error, 'load');
assert.equal(getPersistenceSnapshot().mode, 'loading');
assert.equal(canWriteData(), false);
assert.deepEqual(store.getSnapshot(), []);
assert.deepEqual(guest, originalGuest);
assert.throws(() => parseAccountData({ 'unrelated-secret': 'no' }));
assert.throws(() => parseAccountData({ [key]: [] }));
activateGuestStorage();
console.log(`Verified guest/account isolation, import, locale/presets, offline guard, retries, serial writes, conflicts and stale responses (${saveCount} save attempts).`);
