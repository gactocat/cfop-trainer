// One GAN Gen4 connection, independent of the Bluetooth stack: encryption,
// the protocol driver, one write at a time, and the traffic log. A transport
// (Web Bluetooth in the browser, the Capacitor plugin in the iOS app) sets up
// the link, feeds notifications to `receive` and writes what it is given.

import {
  GanGen4Cipher,
  GanGen4Driver,
  isValidGanGen4Packet,
  parseMac,
  type GanCubeCommand,
  type GanCubeEvent,
  type GanDriverLink,
  type GanGen4Stats,
} from '@/lib/smart-cube/gan-gen4';

export interface GanTrafficRecord {
  /** Host time in ms, from the connection's clock (performance.now() by default). */
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

export interface GanConnectionOptions {
  /** Host clock in ms for traffic records and move timestamps; defaults to performance.now(). */
  now?: () => number;
}

/** What a Bluetooth stack provides once the cube's characteristics are ready. */
export interface GanGen4Transport {
  /** Write encrypted bytes to the command characteristic. */
  write(data: Uint8Array<ArrayBuffer>): Promise<void>;
  /** Stop notifications and drop the link. Called once, by the session. */
  close(): void;
}

export interface GanGen4Session {
  readonly connection: GanGen4Connection;
  /** Hand over one notification from the state characteristic, as received. */
  receive(raw: Uint8Array): void;
  /** Close the link; `onDisconnect` is called unless `notify` is false (setup failed). */
  close(reason: string, notify?: boolean): void;
}

export const MAC_FORMAT_ERROR = 'Enter the MAC as six hex pairs, e.g. AB:12:CD:34:EF:56';
export const NOT_GEN4_ERROR = 'The GAN Gen4 service was not found; this cube may use another protocol generation';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function startGanGen4Session(
  deviceName: string,
  mac: string,
  handlers: GanConnectionHandlers,
  transport: GanGen4Transport,
  options: GanConnectionOptions = {},
): GanGen4Session {
  const macBytes = parseMac(mac);
  if (!macBytes) throw new Error(MAC_FORMAT_ERROR);
  const now = options.now ?? (() => performance.now());
  const cipher = new GanGen4Cipher(macBytes);
  const driver = new GanGen4Driver();
  let closed = false;

  // One GATT operation at a time; overlapping writes fail on common stacks.
  let writeTail: Promise<void> = Promise.resolve();
  const write = (plain: Uint8Array): Promise<void> => {
    const run = writeTail.then(async () => {
      const data = cipher.encrypt(plain);
      const record: GanTrafficRecord = { t: now(), op: 'write', data: toHex(data), plain: toHex(plain) };
      try {
        await transport.write(data);
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

  const close = (reason: string, notify = true) => {
    if (closed) return;
    closed = true;
    transport.close();
    if (notify) handlers.onDisconnect(reason);
  };

  const link: GanDriverLink = {
    send: (message) => { if (!closed) write(message).catch(() => {}); },
    disconnect: close,
  };

  const receive = (raw: Uint8Array) => {
    if (closed) return;
    const t = now();
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

  return {
    receive,
    close,
    connection: {
      deviceName,
      mac,
      stats: driver.stats,
      sendCommand: (command) => write(driver.createCommandMessage(command)),
      disconnect: () => close('disconnected from the page'),
    },
  };
}
