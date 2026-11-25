// Where solves live, and how they move. A guest keeps them on the device. A
// signed-in user keeps them in the account (one row each in the `solves`
// table, outside the account document, so older app versions never see
// them); changes are saved at once, and kept in an outbox on the device until
// the server has them, so a solve timed offline is not lost. When the server
// cannot keep solves yet (its migration is not applied), a signed-in user
// keeps them on the device as before.
//
// Signing in offers to bring the device's solves into the account once per
// account, as the first sign-in offers the device's other data; choosing to
// import there brings them in without asking again. Records keep their ids,
// so importing twice never doubles them, and the device copies stay.
//
// Framework-free with its storage passed in, so scripts/verify-solve.mts can
// drive it with in-memory backends; solve-store.ts wires the real ones.

import type { SolveEvent, SolveRecord } from '@/lib/solve/solve-record';

export interface DeviceSolves {
  load(event: SolveEvent): Promise<SolveRecord[]>;
  put(record: SolveRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface AccountSolves {
  load(userId: string, event: SolveEvent): Promise<SolveRecord[]>;
  save(userId: string, records: readonly SolveRecord[]): Promise<void>;
  remove(userId: string, ids: readonly string[]): Promise<void>;
}

/** Changes the server does not have yet. */
export interface Outbox {
  upserts: Record<string, SolveRecord>;
  deletes: string[];
}

/** Whether a user's device solves were brought into the account: chosen at first sign-in ('wanted'), or here. */
export type ImportDecision = 'wanted' | 'imported' | 'declined';

/** Small device-local notes kept per user. */
export interface SyncMemory {
  readOutbox(userId: string): Outbox;
  writeOutbox(userId: string, outbox: Outbox): void;
  importDecision(userId: string): ImportDecision | null;
  setImportDecision(userId: string, decision: ImportDecision): void;
}

export type SolveSource = { kind: 'waiting' } | { kind: 'device' } | { kind: 'account'; userId: string };

export interface SolvesSnapshot {
  /** error: the account's solves could not be loaded (new ones are still kept). */
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  /** Newest first. */
  solves: readonly SolveRecord[];
  /** device: a guest's; account: the account's; device-for-account: signed in, but the server cannot keep solves yet. */
  where: 'device' | 'account' | 'device-for-account';
  /** Account changes the server does not have yet. */
  unsaved: number;
  /** The last save failed; it is tried again when back online or by hand. */
  failed: boolean;
  /** Device solves not in the account, offered for import; 0 when none or already decided. */
  offer: number;
}

const SAVE_BATCH = 200;
const LOADING: SolvesSnapshot = { status: 'loading', solves: [], where: 'device', unsaved: 0, failed: false, offer: 0 };
export const EMPTY_OUTBOX: Outbox = { upserts: {}, deletes: [] };

/** The server has no `solves` table or functions yet (PostgREST and Postgres codes for a missing relation or function). */
export function isMissingOnServer(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, status } = error as { code?: unknown; status?: unknown };
  return code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883' || status === 404;
}

const newestFirst = (a: SolveRecord, b: SolveRecord) => b.recordedAt.localeCompare(a.recordedAt);

/** A list with the outbox's changes applied: saved records replaced or added, deleted ones gone. */
export function applyOutbox(solves: readonly SolveRecord[], outbox: Outbox, event: SolveEvent): SolveRecord[] {
  const deleted = new Set(outbox.deletes);
  const changed = Object.values(outbox.upserts).filter((r) => r.event === event && !deleted.has(r.id));
  const ids = new Set(changed.map((r) => r.id));
  return [...changed, ...solves.filter((r) => !ids.has(r.id) && !deleted.has(r.id))].sort(newestFirst);
}

export function outboxSize(outbox: Outbox): number {
  return Object.keys(outbox.upserts).length + outbox.deletes.length;
}

export function createSolveLibrary(deps: {
  device: DeviceSolves | null;
  account: AccountSolves | null;
  memory: SyncMemory;
  online: () => boolean;
}) {
  const { device, account, memory } = deps;
  let source: SolveSource = { kind: 'waiting' };
  let generation = 0;
  const snapshots = new Map<SolveEvent, SolvesSnapshot>();
  const listeners = new Set<() => void>();
  let flushing = false;
  // Ids the account has had while signed in here (loaded, saved or deleted):
  // the device's copies of these are never imported, so a solve deleted from
  // the account does not come back with the device's solves.
  const known = new Map<string, Set<string>>();
  const knownTo = (userId: string) => {
    if (!known.has(userId)) known.set(userId, new Set());
    return known.get(userId)!;
  };

  const set = (event: SolveEvent, patch: Partial<SolvesSnapshot>) => {
    snapshots.set(event, { ...(snapshots.get(event) ?? LOADING), ...patch });
    listeners.forEach((l) => l());
  };
  const user = () => (source.kind === 'account' ? source.userId : null);
  const inAccount = (event: SolveEvent) => {
    const where = snapshots.get(event)?.where;
    return user() !== null && where === 'account';
  };

  async function load(event: SolveEvent) {
    const token = generation;
    const current = source;
    const fresh = () => token === generation;
    if (current.kind === 'waiting') {
      set(event, LOADING);
      return;
    }
    if (current.kind === 'device') {
      set(event, { ...LOADING, where: 'device' });
      if (!device) {
        set(event, { status: 'unavailable', solves: [] });
        return;
      }
      try {
        const solves = await device.load(event);
        if (fresh()) set(event, { status: 'ready', solves: [...solves].sort(newestFirst) });
      } catch {
        if (fresh()) set(event, { status: 'unavailable' });
      }
      return;
    }
    const userId = current.userId;
    const outbox = memory.readOutbox(userId);
    set(event, { ...LOADING, where: 'account', unsaved: outboxSize(outbox) });
    let solves: SolveRecord[];
    try {
      if (!account) throw Object.assign(new Error('No server'), { code: 'PGRST205' });
      solves = await account.load(userId, event);
    } catch (error) {
      if (!fresh()) return;
      if (isMissingOnServer(error)) {
        // Signed in, but the server cannot keep solves yet: the device keeps them.
        set(event, { where: 'device-for-account', unsaved: 0 });
        const onDevice = device ? await device.load(event).catch(() => null) : null;
        if (fresh()) set(event, onDevice ? { status: 'ready', solves: [...onDevice].sort(newestFirst) } : { status: 'unavailable' });
        return;
      }
      set(event, { status: 'error', solves: applyOutbox([], outbox, event) });
      return;
    }
    if (!fresh()) return;
    for (const s of solves) knownTo(userId).add(s.id);
    set(event, { status: 'ready', solves: applyOutbox(solves, outbox, event), failed: false });
    await offerOrImport(event, userId);
    void flush();
  }

  async function offerOrImport(event: SolveEvent, userId: string) {
    const decision = memory.importDecision(userId);
    if (!device || decision === 'imported' || decision === 'declined') return;
    const onDevice = await device.load(event).catch(() => [] as SolveRecord[]);
    if (user() !== userId) return;
    const missing = onDevice.filter((s) => !knownTo(userId).has(s.id));
    if (decision === 'wanted') {
      await bringIn(event, userId, missing);
      return;
    }
    set(event, { offer: missing.length });
  }

  async function bringIn(event: SolveEvent, userId: string, records: readonly SolveRecord[]) {
    const outbox = memory.readOutbox(userId);
    const upserts = { ...outbox.upserts };
    for (const record of records) {
      upserts[record.id] = record;
      knownTo(userId).add(record.id);
    }
    const next = { upserts, deletes: outbox.deletes.filter((id) => !(id in upserts)) };
    memory.writeOutbox(userId, next);
    memory.setImportDecision(userId, 'imported');
    const current = snapshots.get(event)?.solves ?? [];
    set(event, { solves: applyOutbox(current, next, event), offer: 0, unsaved: outboxSize(next) });
    await flush();
  }

  /** Send the outbox to the server, a batch at a time; what changed meanwhile stays for the next round. */
  async function flush(): Promise<void> {
    const userId = user();
    if (!userId || !account || flushing || !deps.online()) return;
    const outbox = memory.readOutbox(userId);
    if (outboxSize(outbox) === 0) return;
    flushing = true;
    const events = [...snapshots.keys()];
    try {
      const upserts = Object.values(outbox.upserts);
      for (let i = 0; i < upserts.length; i += SAVE_BATCH) await account.save(userId, upserts.slice(i, i + SAVE_BATCH));
      for (let i = 0; i < outbox.deletes.length; i += SAVE_BATCH) await account.remove(userId, outbox.deletes.slice(i, i + SAVE_BATCH));
      if (user() !== userId) return;
      const now = memory.readOutbox(userId);
      const left: Outbox = {
        // Read back from storage, so compare by content: an edit made while saving stays.
        upserts: Object.fromEntries(Object.entries(now.upserts).filter(([id, record]) => JSON.stringify(outbox.upserts[id]) !== JSON.stringify(record))),
        deletes: now.deletes.filter((id) => !outbox.deletes.includes(id)),
      };
      memory.writeOutbox(userId, left);
      for (const event of events) if (snapshots.get(event)?.where === 'account') set(event, { unsaved: outboxSize(left), failed: false });
      flushing = false;
      if (outboxSize(left) > 0) await flush();
    } catch {
      if (user() === userId) for (const event of events) if (snapshots.get(event)?.where === 'account') set(event, { failed: true });
    } finally {
      flushing = false;
    }
  }

  /** Change the account's copy: through the outbox, shown at once. */
  function change(event: SolveEvent, userId: string, id: string, edit: (outbox: Outbox) => Outbox) {
    knownTo(userId).add(id);
    const next = edit(memory.readOutbox(userId));
    memory.writeOutbox(userId, next);
    const current = snapshots.get(event)?.solves ?? [];
    set(event, { solves: applyOutbox(current, next, event), unsaved: outboxSize(next) });
    void flush();
  }

  const put = (outbox: Outbox, record: SolveRecord): Outbox => ({
    upserts: { ...outbox.upserts, [record.id]: record },
    deletes: outbox.deletes.filter((id) => id !== record.id),
  });

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot(event: SolveEvent): SolvesSnapshot {
      if (!snapshots.has(event)) {
        snapshots.set(event, LOADING);
        void load(event);
      }
      return snapshots.get(event)!;
    },
    /** Where solves come from now: waiting while the account is decided, the device, or an account. */
    setSource(next: SolveSource) {
      const same = next.kind === source.kind && (next.kind !== 'account' || (source.kind === 'account' && source.userId === next.userId));
      if (same) return;
      source = next;
      generation++;
      for (const event of snapshots.keys()) void load(event);
    },
    /** Keep a new solve, or a changed one (a penalty set or taken off). */
    async save(record: SolveRecord): Promise<void> {
      const userId = user();
      if (userId && (inAccount(record.event) || snapshots.get(record.event)?.status === 'error')) {
        change(record.event, userId, record.id, (outbox) => put(outbox, record));
        return;
      }
      const current = snapshots.get(record.event)?.solves ?? [];
      set(record.event, { solves: [record, ...current.filter((s) => s.id !== record.id)].sort(newestFirst) });
      await device?.put(record);
    },
    async remove(event: SolveEvent, id: string): Promise<void> {
      const userId = user();
      if (userId && (inAccount(event) || snapshots.get(event)?.status === 'error')) {
        change(event, userId, id, (outbox) => {
          const upserts = { ...outbox.upserts };
          delete upserts[id];
          return { upserts, deletes: outbox.deletes.includes(id) ? outbox.deletes : [...outbox.deletes, id] };
        });
        return;
      }
      const current = snapshots.get(event)?.solves ?? [];
      set(event, { solves: current.filter((s) => s.id !== id) });
      await device?.remove(id);
    },
    /** Bring the device's solves into the account (the offer). */
    async importDevice(event: SolveEvent): Promise<void> {
      const userId = user();
      if (!userId || !device || !inAccount(event)) return;
      const onDevice = await device.load(event);
      await bringIn(event, userId, onDevice.filter((s) => !knownTo(userId).has(s.id)));
    },
    declineImport(event: SolveEvent) {
      const userId = user();
      if (!userId) return;
      memory.setImportDecision(userId, 'declined');
      set(event, { offer: 0 });
    },
    /** Try again: a failed save, or a failed load. */
    retry(event: SolveEvent) {
      if (snapshots.get(event)?.status === 'error') void load(event);
      else void flush();
    },
    /** Back online: send what is waiting. */
    resume() {
      void flush();
    },
  };
}

export type SolveLibrary = ReturnType<typeof createSolveLibrary>;
