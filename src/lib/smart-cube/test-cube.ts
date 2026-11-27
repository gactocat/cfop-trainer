// A test cube: a GAN Gen4 cube made in software, for trying the smart cube
// screens without one. It sits where the Bluetooth stack would, behind the
// same session as a real cube (gan-gen4-session.ts): it answers the session's
// encrypted commands and sends encrypted notifications, so everything from
// the protocol driver on (turns, the cube's clock, its state reports, the
// reset) runs the code a real cube does. Turns are given in the user's
// notation and held frame, as a person would make them.

import { SOLVED, applyTurn, type CubeState, type Face } from '@/lib/smart-cube/cube-state';
import { GanGen4Cipher, parseMac } from '@/lib/smart-cube/gan-gen4';
import { startGanGen4Session, type GanConnectionHandlers, type GanGen4Connection } from '@/lib/smart-cube/gan-gen4-session';
import type { Frame } from '@/lib/smart-cube/holding';
import { planSetup } from '@/lib/smart-cube/setup-guide';

export const TEST_CUBE_NAME = 'Test cube';
export const TEST_CUBE_MAC = 'CF:0D:00:00:7E:57';
/** The cube's own name in its hardware report (not GAN's, so no MAC is remembered for it). */
const MODEL = 'Test cube';
const BATTERY = 100;
/** A real cube streams its gyro about ten times a second; this keeps the link alive. */
const KEEPALIVE_MS = 600;

/** Gen4 move face codes, by face. */
const FACE_CODE: Record<Face, number> = { U: 2, R: 32, F: 8, D: 1, L: 16, B: 4 };

/**
 * A 20-byte packet from bit fields [bits, value], most significant bit first;
 * the fields at `littleEndian` indices are written low byte first.
 */
export function packBits(fields: readonly (readonly [number, number])[], littleEndian: readonly number[] = []): Uint8Array {
  let bits = '';
  fields.forEach(([n, v], i) => {
    let word = (v >>> 0).toString(2).padStart(n, '0').slice(-n);
    if (littleEndian.includes(i)) word = (word.match(/.{8}/g) ?? []).reverse().join('');
    bits += word;
  });
  bits = bits.padEnd(160, '0');
  return Uint8Array.from(bits.match(/.{8}/g)!, (byte) => parseInt(byte, 2));
}

/** A MOVE notification: one quarter turn (1 clockwise, 3 counter-clockwise) at `cubeTime` ms. */
export function movePacket(face: Face, amount: 1 | 3, serial: number, cubeTime: number): Uint8Array {
  return packBits([[8, 0x01], [8, 0x09], [32, cubeTime], [16, serial & 0xffff], [2, amount === 3 ? 1 : 0], [6, FACE_CODE[face]]], [2, 3]);
}

/** A FACELETS notification: the cube's state, as the cube reports it (the last piece of each kind is implied). */
export function faceletsPacket(state: CubeState, serial: number): Uint8Array {
  return packBits([
    [8, 0xed], [8, 0x0e], [16, serial & 0xffff],
    ...state.cp.slice(0, 7).map((p) => [3, p] as const),
    ...state.co.slice(0, 7).map((o) => [2, o] as const), [2, 0],
    ...state.ep.slice(0, 11).map((p) => [4, p] as const),
    ...state.eo.slice(0, 11).map((o) => [1, o] as const),
  ], [2]);
}

const batteryPacket = (level: number) => packBits([[8, 0xef], [8, 0x01], [8, level]]);
const gyroPacket = () => packBits([[8, 0xec], [8, 0x0c], [16, 0x7fff]]);
const hardwarePackets = () => [
  packBits([[8, 0xfa], [8, 0x05], [8, 0], [16, 2026], [8, 11], [8, 26]], [3]),
  packBits([[8, 0xfc], [8, MODEL.length + 1], [8, 0], ...[...MODEL].map((c) => [8, c.charCodeAt(0)] as const)]),
  packBits([[8, 0xfd], [8, 0x02], [8, 0], [4, 1], [4, 0]]),
  packBits([[8, 0xfe], [8, 0x02], [8, 0], [4, 1], [4, 0]]),
];

/**
 * A quarter turn of a cube face. `together` marks the second face of a slice
 * quarter: a real cube reports both faces of a slice a few milliseconds
 * apart, so the test cube turns it right after the one before.
 */
export type TestCubeTurn = readonly [face: Face, amount: 1 | 3, together?: boolean];

const mod4 = (n: number) => ((n % 4) + 4) % 4;
const quarters = (face: Face, amount: number): TestCubeTurn[] => {
  const n = mod4(amount);
  return n === 3 ? [[face, 3]] : n === 2 ? [[face, 1], [face, 1]] : n === 1 ? [[face, 1]] : [];
};
const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

/**
 * The quarter turns that make one step of a planned move (its turns per
 * cube face). A slice turns its two faces the same way about their axis, a
 * quarter at a time, both faces together, the face that leads changing from
 * one quarter to the next: M2 from yellow on top is L R', then R' L, which
 * read face by face is "L R2 L", as an M2 was seen recorded from an i4.
 * Anything else is each face's quarters in turn.
 */
export function stepTurns(turns: Partial<Record<Face, number>>): TestCubeTurn[] {
  const faces = (Object.entries(turns) as [Face, number][]).filter(([, n]) => mod4(n) !== 0);
  if (faces.length === 2 && faces[1][0] === OPPOSITE[faces[0][0]] && mod4(faces[0][1] + faces[1][1]) === 0) {
    const [[a, n]] = faces;
    const b = OPPOSITE[a];
    if (mod4(n) !== 2) return [[a, mod4(n) as 1 | 3], [b, mod4(-n) as 1 | 3, true]];
    return [[b, 1], [a, 3, true], [a, 3], [b, 1, true]];
  }
  return faces.flatMap(([face, n]) => quarters(face, n));
}

/** The cube-frame quarter turns for `alg` made from `frame`, and the frame after it (rotations change it). Null when it cannot be read. */
export function testCubeTurns(alg: string, frame: Frame): { turns: TestCubeTurn[]; frame: Frame } | null {
  const plan = planSetup(alg, frame);
  if (!plan) return null;
  return { turns: plan.steps.flatMap((step) => stepTurns(step.turns)), frame: plan.finalFrame };
}

export class TestCube {
  state: CubeState = SOLVED;
  private serial = 0;
  private receive: ((raw: Uint8Array) => void) | null = null;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private readonly cipher: GanGen4Cipher;
  private readonly now: () => number;
  private readonly started: number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
    this.cipher = new GanGen4Cipher(parseMac(TEST_CUBE_MAC)!);
    this.started = now();
  }

  /** The cube's own clock, ms. */
  private get clock() {
    return Math.round(this.now() - this.started);
  }

  get connected() {
    return this.receive !== null;
  }

  /** Connect: a session like a real cube's, its transport answered here. */
  open(handlers: GanConnectionHandlers): GanGen4Connection {
    let link: ReturnType<TestCube['attach']> | null = null;
    const session = startGanGen4Session(TEST_CUBE_NAME, TEST_CUBE_MAC, handlers, {
      write: async (data) => link?.write(data),
      close: () => link?.detach(),
    }, { now: this.now });
    link = this.attach(session.receive);
    return session.connection;
  }

  /**
   * The cube's end of a link, for a stand-in Bluetooth stack (the checks use
   * it): encrypted notifications go to `notify`, `write` takes encrypted
   * commands, and `detach` ends the link.
   */
  attach(notify: (raw: Uint8Array) => void): { write(data: Uint8Array): void; detach(): void } {
    this.detach();
    this.receive = notify;
    this.keepalive = setInterval(() => this.send(gyroPacket()), KEEPALIVE_MS);
    return {
      write: (data) => { if (this.receive === notify) this.command(this.cipher.decrypt(data)); },
      detach: () => { if (this.receive === notify) this.detach(); },
    };
  }

  private detach() {
    this.receive = null;
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
  }

  /** One quarter turn of a cube face, reported as a real cube would. */
  turn(face: Face, amount: 1 | 3) {
    this.state = applyTurn(this.state, face, amount);
    this.serial = (this.serial + 1) & 0xffff;
    this.send(movePacket(face, amount, this.serial, this.clock));
  }

  private send(plain: Uint8Array) {
    // Notifications arrive after the write that asked for them, as over Bluetooth.
    const receive = this.receive;
    if (receive) queueMicrotask(() => receive(this.cipher.encrypt(plain)));
  }

  private command(plain: Uint8Array) {
    const [a, b, , d] = plain;
    if (a === 0xdd && b === 0x04 && d === 0xed) this.send(faceletsPacket(this.state, this.serial));
    else if (a === 0xdd && b === 0x04 && d === 0xef) this.send(batteryPacket(BATTERY));
    else if (a === 0xdf) hardwarePackets().forEach((p) => this.send(p));
    else if (a === 0xd2 && b === 0x0d) this.state = SOLVED;
  }
}

/**
 * Keys that turn the test cube, the layout common to virtual cubes (csTimer
 * and others): the right hand turns R, U and F, the left hand L, U' and F'.
 */
export const TEST_CUBE_KEYS: Readonly<Record<string, string>> = {
  i: 'R', k: "R'", d: 'L', e: "L'", j: 'U', f: "U'", s: 'D', l: "D'", h: 'F', g: "F'", w: 'B', o: "B'",
  u: 'r', m: "r'", v: 'l', r: "l'", '5': 'M', '6': 'M', x: "M'", '.': "M'",
  t: 'x', y: 'x', b: "x'", n: "x'", ';': 'y', a: "y'", p: 'z', q: "z'",
};

/** The move a key makes, or null. */
export const moveForKey = (key: string): string | null => TEST_CUBE_KEYS[key.toLowerCase()] ?? null;
