// Verify the GAN Gen4 port without a cube:
// 1. AES-128 against the FIPS-197 vector and Node's built-in AES.
// 2. Optionally, replay a recorded session (smartcube-web-bluetooth capture
//    format, or a JSON saved from /dev/gan-i4) through GanGen4Cipher and
//    GanGen4Driver and compare with the events recorded alongside it.
//
//   node --import ./scripts/register-src-alias.mjs scripts/verify-gan-gen4.mts [capture.json]
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { decryptBlock128, encryptBlock128, expandKey128 } from '@/lib/smart-cube/aes128';
import {
  GanGen4Cipher,
  GanGen4Driver,
  createCommandMessage,
  isValidGanGen4Packet,
  parseMac,
  type GanCubeCommand,
  type GanCubeEvent,
} from '@/lib/smart-cube/gan-gen4';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
}
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const unhex = (s: string) => new Uint8Array(Buffer.from(s, 'hex'));

// FIPS-197 appendix C.1
const rk = expandKey128(unhex('000102030405060708090a0b0c0d0e0f'));
const ct = encryptBlock128(rk, unhex('00112233445566778899aabbccddeeff'));
check('AES-128 FIPS-197 encrypt', hex(ct) === '69c4e0d86a7b0430d8cdb78070b4c55a', hex(ct));
check('AES-128 FIPS-197 decrypt', hex(decryptBlock128(rk, ct)) === '00112233445566778899aabbccddeeff');

let mismatches = 0;
for (let i = 0; i < 2000; i++) {
  const key = new Uint8Array(randomBytes(16));
  const block = new Uint8Array(randomBytes(16));
  const cipher = createCipheriv('aes-128-ecb', key, null).setAutoPadding(false);
  const expected = Buffer.concat([cipher.update(block), cipher.final()]);
  const keys = expandKey128(key);
  const got = encryptBlock128(keys, block);
  if (hex(got) !== expected.toString('hex') || hex(decryptBlock128(keys, got)) !== hex(block)) mismatches++;
}
check('AES-128 matches node:crypto on 2000 random blocks', mismatches === 0, `${mismatches} mismatches`);

// Synthetic plaintext packets for the move-gap recovery path, which the
// public capture never exercises.
{
  const packet = (fields: [number, number][], littleEndian: number[] = []) => {
    // fields: [bitLength, value] written MSB first; indexes in littleEndian are byte-swapped words.
    let bits = '';
    fields.forEach(([length, value], i) => {
      let word = value.toString(2).padStart(length, '0');
      if (littleEndian.includes(i)) word = (word.match(/.{8}/g) ?? []).reverse().join('');
      bits += word;
    });
    bits = bits.padEnd(160, '0');
    return new Uint8Array((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  };
  const facelets = (serial: number) => packet(
    [[8, 0xed], [8, 0x0e], [16, serial], ...[0, 1, 2, 3, 4, 5, 6].map((c): [number, number] => [3, c]),
      ...Array.from({ length: 7 }, (): [number, number] => [2, 0]), [2, 0], ...Array.from({ length: 11 }, (_v, e): [number, number] => [4, e])],
    [2],
  );
  const faceCode = [2, 32, 8, 1, 16, 4];
  const move = (serial: number, face: number, direction: number, cubeTime: number) =>
    packet([[8, 0x01], [8, 0x09], [32, cubeTime], [16, serial], [2, direction], [6, faceCode[face]]], [2, 3]);
  const historyCode = [1, 5, 3, 0, 4, 2];
  const history = (startSerial: number, moves: [number, number][]) =>
    packet([[8, 0xd1], [8, moves.length / 2 + 1], [8, startSerial], ...moves.flatMap(([face, dir]): [number, number][] => [[3, historyCode[face]], [1, dir]])]);

  const driver = new GanGen4Driver();
  const sent: string[] = [];
  const link = { send: (m: Uint8Array) => { sent.push(hex(m.subarray(0, 6))); }, disconnect: () => {} };
  const out: GanCubeEvent[] = [];
  out.push(...driver.handleStateEvent(link, facelets(10), 0));
  out.push(...driver.handleStateEvent(link, move(11, 1, 0, 1000), 10)); // R
  out.push(...driver.handleStateEvent(link, move(13, 0, 0, 1200), 20)); // U, serial 12 lost
  out.push(...driver.handleStateEvent(link, history(13, [[0, 0], [2, 1]]), 30)); // 13 U, 12 F'
  out.push(...driver.handleStateEvent(link, move(13, 0, 0, 1200), 40)); // duplicate
  const delivered = out.flatMap((e) => (e.type === 'MOVE' ? [`${e.serial}:${e.move}:${e.localTimestamp ?? 'null'}`] : []));
  check('solved FACELETS packet decodes as solved', out[0]?.type === 'FACELETS' && out[0].facelets === 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  check('a lost move is requested from history', sent.join(',') === 'd1040d000200', sent.join(','));
  check('the recovered move is delivered in order', delivered.join(' ') === "11:R:10 12:F':null 13:U:20", delivered.join(' '));
  check('stats count the gap, recovery and duplicate',
    driver.stats.gapsDetected === 1 && driver.stats.recoveredMoves === 1 && driver.stats.duplicateMoves === 1,
    JSON.stringify(driver.stats));
}

const capturePath = process.argv[2];
if (capturePath) {
  type Traffic = { t: number; op: string; characteristic?: string; data?: string };
  const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as {
    device: { name: string; mac: string };
    traffic: Traffic[];
    events: { t: number; event: GanCubeEvent }[];
    /** Present in logs saved from /dev/gan-i4; each connection starts a fresh driver. */
    connectionLog?: { t: number; type: string }[];
  };
  const mac = parseMac(capture.device.mac);
  check('capture has a valid MAC', mac !== null, capture.device.mac);
  if (mac) {
    const cipher = new GanGen4Cipher(mac);
    let driver = new GanGen4Driver();
    const connectionStarts = (capture.connectionLog ?? []).filter((c) => c.type === 'connecting').map((c) => c.t);
    const sent: Uint8Array[] = [];
    const link = { send: (m: Uint8Array) => { sent.push(m); }, disconnect: () => {} };
    const decoded: GanCubeEvent[] = [];
    let notifications = 0;
    let invalid = 0;
    const commandNames = new Map<string, string>();
    for (const type of ['REQUEST_FACELETS', 'REQUEST_HARDWARE', 'REQUEST_BATTERY', 'REQUEST_RESET'] as const) {
      const command: GanCubeCommand = { type };
      commandNames.set(hex(cipher.encrypt(createCommandMessage(command))), type);
    }
    const writes: string[] = [];
    const invalidTypes = new Set<string>();
    for (const t of capture.traffic) {
      if (connectionStarts.length > 0 && t.t >= connectionStarts[0]) {
        connectionStarts.shift();
        driver = new GanGen4Driver();
      }
      if (!t.data) continue;
      if (t.op === 'write') {
        writes.push(commandNames.get(t.data.toLowerCase()) ?? `other:${hex(cipher.decrypt(unhex(t.data))).slice(0, 12)}`);
      } else if (t.op === 'notify') {
        notifications++;
        const plain = cipher.decrypt(unhex(t.data));
        if (!isValidGanGen4Packet(plain)) {
          invalid++;
          invalidTypes.add(`0x${plain[0].toString(16)}`);
          continue;
        }
        decoded.push(...driver.handleStateEvent(link, plain, t.t));
      }
    }
    // The capture's events start a little after its traffic; compare the overlap.
    const recorded = capture.events.map((e) => e.event);
    const from = capture.events.length > 0 ? capture.events[0].t - 5 : 0;
    const overlap = decoded.filter((e) => e.timestamp >= from);
    const count = (list: GanCubeEvent[]) =>
      list.reduce<Record<string, number>>((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {});
    const moves = (list: GanCubeEvent[]) => list.flatMap((e) => (e.type === 'MOVE' ? [e.move] : [])).join(' ');
    const facelets = (list: GanCubeEvent[]) => list.flatMap((e) => (e.type === 'FACELETS' ? [e.facelets] : []));
    console.log(`     device ${capture.device.name}, ${notifications} notifications, ${invalid} failed validation (types ${[...invalidTypes].join(', ') || '-'})`);
    console.log(`     decoded  ${JSON.stringify(count(decoded))}, ${overlap.length} from the first recorded event`);
    console.log(`     recorded ${JSON.stringify(count(recorded))}`);
    console.log(`     writes in capture: ${writes.join(', ')}`);
    console.log(`     moves: ${moves(overlap)}`);
    // Unknown packet types (e.g. extra info packets) fail validation; noise from a wrong MAC would fail almost all.
    check('at most 5% of notifications fail validation', invalid <= notifications * 0.05, `${invalid} of ${notifications}`);
    check('moves match the recorded events', moves(overlap) === moves(recorded));
    check('facelets match the recorded events', JSON.stringify(facelets(overlap)) === JSON.stringify(facelets(recorded)));
    const sorted = (value: unknown): unknown =>
      value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)]))
        : value;
    const pick = (list: GanCubeEvent[], type: GanCubeEvent['type']) => JSON.stringify(
      list.filter((e) => e.type === type).map(({ timestamp: _t, ...rest }) => sorted(rest)), // eslint-disable-line @typescript-eslint/no-unused-vars
    );
    check('battery events match', pick(overlap, 'BATTERY') === pick(recorded, 'BATTERY'), pick(overlap, 'BATTERY'));
    check('hardware events match', pick(overlap, 'HARDWARE') === pick(recorded, 'HARDWARE'), pick(overlap, 'HARDWARE'));
    check('gyro events match', pick(overlap, 'GYRO') === pick(recorded, 'GYRO'), `${count(overlap).GYRO} vs ${count(recorded).GYRO}`);
    check('our command encryption reproduces recorded writes', writes.some((w) => !w.startsWith('other:')));
    console.log(`     driver stats ${JSON.stringify(driver.stats)}, history requests sent ${sent.length}`);
  }
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
