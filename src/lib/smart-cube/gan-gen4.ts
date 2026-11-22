// GAN Gen4 smart cube protocol: constants, encryption, packet checks and the
// event driver. Transport independent; see gan-web-bluetooth.ts for the
// Web Bluetooth side.
//
// Ported from smartcube-web-bluetooth (MIT License), commit 2077416d6c82,
// files src/gan-cube-definitions.ts, src/gan-cube-encrypter.ts,
// src/gan-mac-salt.ts, src/gan-gen234-packet-validate.ts,
// src/gan-cube-protocol.ts (GanProtocolMessageView, GanGen4ProtocolDriver) and
// src/utils.ts (toKociembaFacelets):
//   https://github.com/poliva/smartcube-web-bluetooth
//   Copyright (c) Pau Oliva, https://github.com/poliva
//   Copyright (c) Andy Fedotov, https://github.com/afedotov
// The full license text is in LICENSE-smartcube-web-bluetooth.txt next to
// this file.
//
// Changes from the original:
// - AES comes from ./aes128 instead of aes-js; no RxJS.
// - Only the 3x3 Gen4 path is kept (no Gen2/Gen3, no GAN 251 UI 2x2 key).
// - handleStateEvent is synchronous and takes the notification arrival time.
//   Commands the driver sends itself (move history requests) are fire and
//   forget, so a pending GATT write never delays later notifications.
// - A MOVE whose serial equals the last delivered one is dropped as a
//   duplicate instead of being delivered twice.
// - When more than 16 moves wait behind a gap, the buffer is flushed and the
//   gap counted, instead of disconnecting the cube, so a spike can keep
//   observing the link.
// - Diagnostic counters (GanGen4Stats).

import { decryptBlock128, encryptBlock128, expandKey128 } from '@/lib/smart-cube/aes128';

/** GAN Gen4 protocol BLE service. */
export const GAN_GEN4_SERVICE = '00000010-0000-fff7-fff6-fff5fff4fff0';
/** GAN Gen4 protocol BLE command characteristic (write). */
export const GAN_GEN4_COMMAND_CHARACTERISTIC = '0000fff5-0000-1000-8000-00805f9b34fb';
/** GAN Gen4 protocol BLE state characteristic (notify). */
export const GAN_GEN4_STATE_CHARACTERISTIC = '0000fff6-0000-1000-8000-00805f9b34fb';

/** Company identifiers GAN cubes may use for manufacturer data: 0x0001, 0x0101, ... 0xFF01. */
export const GAN_CIC_LIST: number[] = Array.from({ length: 256 }, (_v, i) => (i << 8) | 0x01);

/** Key and IV shared by GAN Gen2, Gen3 and Gen4 cubes, salted per cube with its MAC. */
const GAN_KEY = [0x01, 0x02, 0x42, 0x28, 0x31, 0x91, 0x16, 0x07, 0x20, 0x05, 0x18, 0x54, 0x42, 0x11, 0x12, 0x53];
const GAN_IV = [0x11, 0x03, 0x32, 0x28, 0x21, 0x01, 0x76, 0x27, 0x20, 0x95, 0x78, 0x14, 0x32, 0x12, 0x02, 0x43];

/** Parse "AA:BB:CC:DD:EE:FF" (also "-" or space separated) into 6 bytes in display order. */
export function parseMac(input: string): Uint8Array | null {
  const parts = input.trim().split(/[:\-\s]+/).filter(Boolean);
  if (parts.length !== 6 || parts.some((p) => !/^[0-9a-f]{1,2}$/i.test(p))) return null;
  return new Uint8Array(parts.map((p) => parseInt(p, 16)));
}

export function formatMac(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
}

/**
 * Read the MAC from the manufacturer specific data a GAN cube advertises under
 * one of GAN_CIC_LIST: the last 6 of the first 9 bytes, in reverse order.
 */
export function macFromManufacturerData(data: DataView): string | null {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, Math.min(9, data.byteLength));
  if (bytes.length < 6) return null;
  const mac = new Uint8Array(6);
  for (let i = 0; i < 6; i++) mac[i] = bytes[bytes.length - 1 - i];
  return formatMac(mac);
}

/** AES-128-CBC with a fixed IV applied to the first and the last 16 bytes of each message. */
export class GanGen4Cipher {
  private readonly roundKeys: Uint8Array;
  private readonly iv: Uint8Array;

  constructor(mac: Uint8Array) {
    if (mac.length !== 6) throw new Error('MAC must be 6 bytes');
    const salt = mac.slice().reverse();
    const key = new Uint8Array(GAN_KEY);
    const iv = new Uint8Array(GAN_IV);
    for (let i = 0; i < 6; i++) {
      // Modulo 0xFF (not 0x100) is what the cubes expect.
      key[i] = (GAN_KEY[i] + salt[i]) % 0xff;
      iv[i] = (GAN_IV[i] + salt[i]) % 0xff;
    }
    this.roundKeys = expandKey128(key);
    this.iv = iv;
  }

  private encryptChunk(buffer: Uint8Array, offset: number) {
    const block = buffer.slice(offset, offset + 16);
    for (let i = 0; i < 16; i++) block[i] ^= this.iv[i];
    buffer.set(encryptBlock128(this.roundKeys, block), offset);
  }

  private decryptChunk(buffer: Uint8Array, offset: number) {
    const block = decryptBlock128(this.roundKeys, buffer.subarray(offset, offset + 16));
    for (let i = 0; i < 16; i++) block[i] ^= this.iv[i];
    buffer.set(block, offset);
  }

  encrypt(data: Uint8Array): Uint8Array<ArrayBuffer> {
    if (data.length < 16) throw new Error('Data must be at least 16 bytes long');
    const res = new Uint8Array(data);
    this.encryptChunk(res, 0);
    if (res.length > 16) this.encryptChunk(res, res.length - 16);
    return res;
  }

  decrypt(data: Uint8Array): Uint8Array<ArrayBuffer> {
    if (data.length < 16) throw new Error('Data must be at least 16 bytes long');
    const res = new Uint8Array(data);
    if (res.length > 16) this.decryptChunk(res, res.length - 16);
    this.decryptChunk(res, 0);
    return res;
  }
}

/** Read arbitrary bit words from a decrypted message, most significant bit first. */
export class GanBitReader {
  private readonly bits: string;

  constructor(message: Uint8Array) {
    this.bits = Array.from(message, (byte) => (byte + 0x100).toString(2).slice(1)).join('');
  }

  get length(): number {
    return this.bits.length;
  }

  getBitWord(startBit: number, bitLength: number, littleEndian = false): number {
    if (bitLength <= 8) return parseInt(this.bits.slice(startBit, startBit + bitLength), 2);
    if (bitLength === 16 || bitLength === 32) {
      const buf = new Uint8Array(bitLength / 8);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = parseInt(this.bits.slice(8 * i + startBit, 8 * i + startBit + 8), 2);
      }
      const dv = new DataView(buf.buffer);
      return bitLength === 16 ? dv.getUint16(0, littleEndian) : dv.getUint32(0, littleEndian);
    }
    throw new Error('Unsupported bit word length');
  }
}

/** Gen4 move face codes, in URFDLB order. */
const MOVE_FACE_CODES = [2, 32, 8, 1, 16, 4];
const KNOWN_EVENT_TYPES = [0x01, 0xd1, 0xed, 0xec, 0xef, 0xea, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe];

/** Structural check of a decrypted Gen4 payload; a wrong MAC yields noise that fails it. */
export function isValidGanGen4Packet(message: Uint8Array): boolean {
  if (message.length < 16) return false;
  const msg = new GanBitReader(message);
  const type = msg.getBitWord(0, 8);
  if (!KNOWN_EVENT_TYPES.includes(type)) return false;
  if (type === 0x01 && !MOVE_FACE_CODES.includes(msg.getBitWord(66, 6))) return false;
  return true;
}

export type GanCubeCommand =
  | { type: 'REQUEST_FACELETS' }
  | { type: 'REQUEST_HARDWARE' }
  | { type: 'REQUEST_BATTERY' }
  /** Reset the cube's internal state to solved. */
  | { type: 'REQUEST_RESET' };

export interface GanCubeMove {
  /** 0 U, 1 R, 2 F, 3 D, 4 L, 5 B */
  face: number;
  /** 0 clockwise, 1 counter-clockwise */
  direction: number;
  /** Standard notation, e.g. "R'" */
  move: string;
  /** Host clock (ms); null for a move recovered from history. */
  localTimestamp: number | null;
  /** Cube clock (ms); null for a move recovered from history. */
  cubeTimestamp: number | null;
}

export interface GanCubeState {
  CP: number[];
  CO: number[];
  EP: number[];
  EO: number[];
}

export type GanCubeEvent = { timestamp: number } & (
  | ({ type: 'MOVE'; serial: number } & GanCubeMove)
  | { type: 'FACELETS'; serial: number; facelets: string; state: GanCubeState }
  | {
      type: 'GYRO';
      /** Right-handed: +X red, +Y blue, +Z white. */
      quaternion: { x: number; y: number; z: number; w: number };
      velocity: { x: number; y: number; z: number };
    }
  | { type: 'BATTERY'; batteryLevel: number }
  | {
      type: 'HARDWARE';
      hardwareName?: string;
      softwareVersion?: string;
      hardwareVersion?: string;
      productDate?: string;
      gyroSupported?: boolean;
    }
);

export type GanMoveEvent = Extract<GanCubeEvent, { type: 'MOVE' }>;

/** What the driver needs from the connection. */
export interface GanDriverLink {
  /** Encrypt and send a plain command; fire and forget. */
  send(message: Uint8Array): void;
  disconnect(reason: string): void;
}

export interface GanGen4Stats {
  /** Distinct serial gaps seen when moves arrived. */
  gapsDetected: number;
  historyRequests: number;
  /** Moves filled in from history (they have null timestamps). */
  recoveredMoves: number;
  duplicateMoves: number;
  /** Gaps given up on because too many moves waited behind them. */
  overflowFlushes: number;
  /** Moves received before the first FACELETS event, which are ignored. */
  movesBeforeSync: number;
  unknownPackets: number;
}

export function createCommandMessage(command: GanCubeCommand): Uint8Array {
  const msg = new Uint8Array(20);
  switch (command.type) {
    case 'REQUEST_FACELETS':
      msg.set([0xdd, 0x04, 0x00, 0xed, 0x00, 0x00]);
      break;
    case 'REQUEST_HARDWARE':
      msg.set([0xdf, 0x03, 0x00, 0x00, 0x00]);
      break;
    case 'REQUEST_BATTERY':
      msg.set([0xdd, 0x04, 0x00, 0xef, 0x00, 0x00]);
      break;
    case 'REQUEST_RESET':
      msg.set([0xd2, 0x0d, 0x05, 0x39, 0x77, 0x00, 0x00, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0x00, 0x00, 0x00]);
      break;
  }
  return msg;
}

const sum = (arr: number[]) => arr.reduce((a, v) => a + v, 0);

export class GanGen4Driver {
  private serial = -1;
  private lastSerial = -1;
  private lastLocalTimestamp: number | null = null;
  private moveBuffer: GanMoveEvent[] = [];
  private lastGapHead = -1;
  // Partial hardware info, keyed by event type.
  private hwInfo: Record<number, string> = {};
  private gyroObserved = false;
  private hardwareInfoEmitted = false;

  readonly stats: GanGen4Stats = {
    gapsDetected: 0,
    historyRequests: 0,
    recoveredMoves: 0,
    duplicateMoves: 0,
    overflowFlushes: 0,
    movesBeforeSync: 0,
    unknownPackets: 0,
  };

  createCommandMessage(command: GanCubeCommand): Uint8Array {
    if (command.type === 'REQUEST_HARDWARE') {
      this.hwInfo = {};
      this.hardwareInfoEmitted = false;
    }
    return createCommandMessage(command);
  }

  private buildHardwareEvent(timestamp: number): GanCubeEvent {
    return {
      type: 'HARDWARE',
      timestamp,
      hardwareName: this.hwInfo[0xfc],
      hardwareVersion: this.hwInfo[0xfe],
      softwareVersion: this.hwInfo[0xfd],
      productDate: this.hwInfo[0xfa],
      gyroSupported: this.gyroObserved,
    };
  }

  private requestMoveHistory(link: GanDriverLink, serial: number, count: number) {
    // History responses are byte aligned and always start at an odd serial,
    // so request an odd-aligned window with an even number of moves.
    if (serial % 2 === 0) serial = (serial - 1) & 0xff;
    if (count % 2 === 1) count++;
    // Never cross the 255 -> 0 edge: firmware spoofs those moves as 'D'.
    count = Math.min(count, serial + 1);
    const msg = new Uint8Array(20);
    msg.set([0xd1, 0x04, serial, 0, count, 0]);
    this.stats.historyRequests++;
    link.send(msg);
  }

  // Deliver buffered moves up to the first gap; with a link, ask for the
  // missing moves.
  private evictMoveBuffer(link?: GanDriverLink): GanCubeEvent[] {
    const evicted: GanCubeEvent[] = [];
    while (this.moveBuffer.length > 0) {
      const head = this.moveBuffer[0];
      const diff = this.lastSerial === -1 ? 1 : (head.serial - this.lastSerial) & 0xff;
      if (diff === 0) {
        this.moveBuffer.shift();
        this.stats.duplicateMoves++;
      } else if (diff > 1) {
        if (head.serial !== this.lastGapHead) {
          this.lastGapHead = head.serial;
          this.stats.gapsDetected++;
        }
        if (link) this.requestMoveHistory(link, head.serial, diff);
        break;
      } else {
        evicted.push(this.moveBuffer.shift()!);
        this.lastSerial = head.serial;
      }
    }
    if (link && this.moveBuffer.length > 16) {
      this.stats.overflowFlushes++;
      evicted.push(...this.moveBuffer);
      this.lastSerial = this.moveBuffer[this.moveBuffer.length - 1].serial;
      this.moveBuffer = [];
    }
    return evicted;
  }

  // Whether `serial` lies in the circular (start, end) range; closed ends optional.
  private isSerialInRange(start: number, end: number, serial: number, closedStart = false, closedEnd = false) {
    return ((end - start) & 0xff) >= ((serial - start) & 0xff)
      && (closedStart || ((start - serial) & 0xff) > 0)
      && (closedEnd || ((end - serial) & 0xff) > 0);
  }

  private injectMissedMove(move: GanMoveEvent) {
    if (this.moveBuffer.length > 0) {
      const head = this.moveBuffer[0];
      if (this.moveBuffer.some((e) => e.serial === move.serial)) return;
      if (!this.isSerialInRange(this.lastSerial, head.serial, move.serial)) return;
      // History arrives newest first, so only the move right before the head fits.
      if (move.serial === ((head.serial - 1) & 0xff)) {
        this.moveBuffer.unshift(move);
        this.stats.recoveredMoves++;
      }
    } else if (this.isSerialInRange(this.lastSerial, this.serial, move.serial, false, true)) {
      // A move lost at the end of a burst, noticed through a FACELETS event.
      this.moveBuffer.unshift(move);
      this.stats.recoveredMoves++;
    }
  }

  private checkIfMoveMissed(link: GanDriverLink) {
    const diff = (this.serial - this.lastSerial) & 0xff;
    // Serial 0 is skipped to avoid a firmware bug with FACELETS at counter 255.
    if (diff > 0 && this.serial !== 0) {
      const head = this.moveBuffer[0];
      const startSerial = head ? head.serial : (this.serial + 1) & 0xff;
      this.requestMoveHistory(link, startSerial, diff + 1);
    }
  }

  /** Handle one decrypted notification received at `timestamp` (host clock, ms). */
  handleStateEvent(link: GanDriverLink, message: Uint8Array, timestamp: number): GanCubeEvent[] {
    const events: GanCubeEvent[] = [];
    const msg = new GanBitReader(message);
    const eventType = msg.getBitWord(0, 8);
    const dataLength = msg.getBitWord(8, 8);

    if (eventType === 0x01) {
      // MOVE. Accepted only after the first FACELETS event has set the serial.
      if (this.lastSerial === -1) {
        this.stats.movesBeforeSync++;
        return events;
      }
      // One notification may carry several 72-bit move records.
      for (let off = 0; off + 72 <= msg.length && msg.getBitWord(off, 8) === 0x01; off += 72) {
        const cubeTimestamp = msg.getBitWord(off + 16, 32, true);
        const serial = msg.getBitWord(off + 48, 16, true);
        const direction = msg.getBitWord(off + 64, 2);
        const face = MOVE_FACE_CODES.indexOf(msg.getBitWord(off + 66, 6));
        if (face < 0) break;
        this.serial = serial;
        this.moveBuffer.push({
          type: 'MOVE',
          serial,
          timestamp,
          localTimestamp: timestamp,
          cubeTimestamp,
          face,
          direction,
          move: ('URFDLB'.charAt(face) + " '".charAt(direction)).trim(),
        });
        this.lastLocalTimestamp = timestamp;
      }
      return this.evictMoveBuffer(link);
    }

    if (eventType === 0xd1) {
      // MOVE_HISTORY, newest first.
      const startSerial = msg.getBitWord(16, 8);
      const count = (dataLength - 1) * 2;
      for (let i = 0; i < count; i++) {
        const face = [1, 5, 3, 0, 4, 2].indexOf(msg.getBitWord(24 + 4 * i, 3));
        const direction = msg.getBitWord(27 + 4 * i, 1);
        if (face < 0) continue;
        this.injectMissedMove({
          type: 'MOVE',
          serial: (startSerial - i) & 0xff,
          timestamp,
          localTimestamp: null,
          cubeTimestamp: null,
          face,
          direction,
          move: ('URFDLB'.charAt(face) + " '".charAt(direction)).trim(),
        });
      }
      return this.evictMoveBuffer();
    }

    if (eventType === 0xed) {
      // FACELETS, sent on request and periodically.
      const serial = (this.serial = msg.getBitWord(16, 16, true));
      // Debounced: only look for missed moves once turning has paused.
      if (this.lastSerial !== -1 && this.lastLocalTimestamp !== null && timestamp - this.lastLocalTimestamp > 500) {
        this.checkIfMoveMissed(link);
      }
      if (this.lastSerial === -1) this.lastSerial = serial;

      const cp: number[] = [];
      const co: number[] = [];
      const ep: number[] = [];
      const eo: number[] = [];
      for (let i = 0; i < 7; i++) {
        cp.push(msg.getBitWord(32 + i * 3, 3));
        co.push(msg.getBitWord(53 + i * 2, 2));
      }
      cp.push(28 - sum(cp));
      co.push((3 - (sum(co) % 3)) % 3);
      for (let i = 0; i < 11; i++) {
        ep.push(msg.getBitWord(69 + i * 4, 4));
        eo.push(msg.getBitWord(113 + i, 1));
      }
      ep.push(66 - sum(ep));
      eo.push((2 - (sum(eo) % 2)) % 2);

      events.push({
        type: 'FACELETS',
        serial,
        timestamp,
        facelets: toKociembaFacelets(cp, co, ep, eo),
        state: { CP: cp, CO: co, EP: ep, EO: eo },
      });
      return events;
    }

    if (eventType >= 0xfa && eventType <= 0xfe) {
      // HARDWARE info arrives as separate packets.
      if (eventType === 0xfa) {
        const year = msg.getBitWord(24, 16, true);
        const month = msg.getBitWord(40, 8);
        const day = msg.getBitWord(48, 8);
        this.hwInfo[eventType] = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (eventType === 0xfc) {
        let name = '';
        for (let i = 0; i < dataLength - 1; i++) name += String.fromCharCode(msg.getBitWord(i * 8 + 24, 8));
        this.hwInfo[eventType] = name;
      } else if (eventType === 0xfd || eventType === 0xfe) {
        this.hwInfo[eventType] = `${msg.getBitWord(24, 4)}.${msg.getBitWord(28, 4)}`;
      }
      if (Object.keys(this.hwInfo).length === 4) {
        this.hardwareInfoEmitted = true;
        events.push(this.buildHardwareEvent(timestamp));
      }
      return events;
    }

    if (eventType === 0xec) {
      // GYRO
      const firstGyro = !this.gyroObserved;
      this.gyroObserved = true;
      const qw = msg.getBitWord(16, 16);
      const qx = msg.getBitWord(32, 16);
      const qy = msg.getBitWord(48, 16);
      const qz = msg.getBitWord(64, 16);
      const vx = msg.getBitWord(80, 4);
      const vy = msg.getBitWord(84, 4);
      const vz = msg.getBitWord(88, 4);
      const q = (v: number) => ((1 - (v >> 15) * 2) * (v & 0x7fff)) / 0x7fff;
      const v = (n: number) => (1 - (n >> 3) * 2) * (n & 0x7);
      events.push({
        type: 'GYRO',
        timestamp,
        quaternion: { x: q(qx), y: q(qy), z: q(qz), w: q(qw) },
        velocity: { x: v(vx), y: v(vy), z: v(vz) },
      });
      // Re-emit hardware info once gyro support is known.
      if (firstGyro && this.hardwareInfoEmitted && Object.keys(this.hwInfo).length === 4) {
        events.push(this.buildHardwareEvent(timestamp));
      }
      return events;
    }

    if (eventType === 0xef) {
      // BATTERY
      const batteryLevel = msg.getBitWord(8 + dataLength * 8, 8);
      events.push({ type: 'BATTERY', timestamp, batteryLevel: Math.min(batteryLevel, 100) });
      return events;
    }

    if (eventType === 0xea) {
      link.disconnect('cube sent a disconnect notice (0xEA)');
      return events;
    }

    this.stats.unknownPackets++;
    return events;
  }
}

const CORNER_FACELET_MAP = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
];

const EDGE_FACELET_MAP = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
];

export const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/** Corner/edge permutation and orientation to a Kociemba facelets string (URFDLB, 9 each). */
export function toKociembaFacelets(cp: number[], co: number[], ep: number[], eo: number[]): string {
  const faces = 'URFDLB';
  const facelets: string[] = [];
  for (let i = 0; i < 54; i++) facelets[i] = faces[Math.floor(i / 9)];
  for (let i = 0; i < 8; i++) {
    for (let p = 0; p < 3; p++) {
      facelets[CORNER_FACELET_MAP[i][(p + co[i]) % 3]] = faces[Math.floor(CORNER_FACELET_MAP[cp[i]][p] / 9)];
    }
  }
  for (let i = 0; i < 12; i++) {
    for (let p = 0; p < 2; p++) {
      facelets[EDGE_FACELET_MAP[i][(p + eo[i]) % 2]] = faces[Math.floor(EDGE_FACELET_MAP[ep[i]][p] / 9)];
    }
  }
  return facelets.join('');
}
