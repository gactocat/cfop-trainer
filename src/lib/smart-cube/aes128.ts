// Minimal synchronous AES-128 block cipher (FIPS-197), enough for the GAN
// smart cube protocol, which encrypts single 16-byte blocks. Web Crypto has no
// raw block mode and is asynchronous, so the cipher is implemented here rather
// than adding a dependency. Verified by scripts/verify-gan-gen4.mts against the
// FIPS-197 test vector and Node's built-in AES.

const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);

const rotl8 = (x: number, shift: number) => ((x << shift) | (x >>> (8 - shift))) & 0xff;
const xtime = (b: number) => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;

function mul(a: number, b: number): number {
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    a = xtime(a);
    b >>= 1;
  }
  return result;
}

// Generate the S-box from the multiplicative inverse in GF(2^8) and the affine
// transform: p walks the field by multiplying by 3, q by dividing by 3, so q
// is always the inverse of p.
(() => {
  let p = 1;
  let q = 1;
  do {
    p = p ^ xtime(p);
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    SBOX[p] = q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63;
  } while (p !== 1);
  SBOX[0] = 0x63;
  for (let i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;
})();

/** Expand a 16-byte key into the 11 round keys (176 bytes). */
export function expandKey128(key: Uint8Array): Uint8Array {
  if (key.length !== 16) throw new Error('AES-128 key must be 16 bytes');
  const rk = new Uint8Array(176);
  rk.set(key);
  let rcon = 1;
  for (let i = 16; i < 176; i += 4) {
    let t0 = rk[i - 4];
    let t1 = rk[i - 3];
    let t2 = rk[i - 2];
    let t3 = rk[i - 1];
    if (i % 16 === 0) {
      const first = t0;
      t0 = SBOX[t1] ^ rcon;
      t1 = SBOX[t2];
      t2 = SBOX[t3];
      t3 = SBOX[first];
      rcon = xtime(rcon);
    }
    rk[i] = rk[i - 16] ^ t0;
    rk[i + 1] = rk[i - 15] ^ t1;
    rk[i + 2] = rk[i - 14] ^ t2;
    rk[i + 3] = rk[i - 13] ^ t3;
  }
  return rk;
}

// The state is kept in input order: byte 4c + r is row r of column c.
function addRoundKey(s: Uint8Array, rk: Uint8Array, round: number) {
  for (let i = 0; i < 16; i++) s[i] ^= rk[round * 16 + i];
}

function shiftRows(s: Uint8Array, inverse: boolean) {
  const t = s.slice();
  for (let c = 0; c < 4; c++) {
    for (let r = 1; r < 4; r++) {
      const from = inverse ? (c - r + 4) % 4 : (c + r) % 4;
      s[4 * c + r] = t[4 * from + r];
    }
  }
}

function mixColumns(s: Uint8Array, inverse: boolean) {
  for (let c = 0; c < 4; c++) {
    const [a0, a1, a2, a3] = [s[4 * c], s[4 * c + 1], s[4 * c + 2], s[4 * c + 3]];
    if (inverse) {
      s[4 * c] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
      s[4 * c + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
      s[4 * c + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
      s[4 * c + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
    } else {
      s[4 * c] = xtime(a0) ^ xtime(a1) ^ a1 ^ a2 ^ a3;
      s[4 * c + 1] = a0 ^ xtime(a1) ^ xtime(a2) ^ a2 ^ a3;
      s[4 * c + 2] = a0 ^ a1 ^ xtime(a2) ^ xtime(a3) ^ a3;
      s[4 * c + 3] = xtime(a0) ^ a0 ^ a1 ^ a2 ^ xtime(a3);
    }
  }
}

/** Encrypt one 16-byte block with expanded round keys. */
export function encryptBlock128(rk: Uint8Array, block: Uint8Array): Uint8Array {
  const s = new Uint8Array(block.subarray(0, 16));
  addRoundKey(s, rk, 0);
  for (let round = 1; round <= 10; round++) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    shiftRows(s, false);
    if (round < 10) mixColumns(s, false);
    addRoundKey(s, rk, round);
  }
  return s;
}

/** Decrypt one 16-byte block with expanded round keys. */
export function decryptBlock128(rk: Uint8Array, block: Uint8Array): Uint8Array {
  const s = new Uint8Array(block.subarray(0, 16));
  addRoundKey(s, rk, 10);
  for (let round = 9; round >= 0; round--) {
    shiftRows(s, true);
    for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    addRoundKey(s, rk, round);
    if (round > 0) mixColumns(s, true);
  }
  return s;
}
