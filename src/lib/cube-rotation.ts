import { tokenizeAlg } from '@/lib/invert-alg';

// Tracks the whole-cube rotation an algorithm leaves behind, so that a setup
// derived from an algorithm containing rotations (a leading y', a d, an
// unbalanced r, ...) can be made rotation-neutral.
//
// Why this matters: inverting "y' U R' U R U' R' U' R" naively gives
// "R' U R U R' U' R U' y". Executed from a solved cube that sets up the
// back-right pair and leaves the cube turned, which only works if the user
// keeps holding the cube as the scramble left it. Appending the compensating
// rotation before inverting ("y' R' U R U R' U' R U' y") sets up the
// front-right pair with the centers back home.

type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];

// An orientation maps each position to the face that currently sits there.
type Orientation = Record<Face, Face>;

const IDENTITY: Orientation = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' };

// Where each position takes its content from when the rotation is applied once.
//   x (follows R): the F face moves up.   y (follows U): the R face moves to F.
//   z (follows F): the U face moves right.
const SOURCE: Record<'x' | 'y' | 'z', Partial<Record<Face, Face>>> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U' },
  y: { F: 'R', R: 'B', B: 'L', L: 'F' },
  z: { U: 'L', L: 'D', D: 'R', R: 'U' },
};

function rotate(o: Orientation, axis: 'x' | 'y' | 'z', times: number): Orientation {
  let cur = o;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) {
    const next = { ...cur };
    for (const [pos, from] of Object.entries(SOURCE[axis]) as [Face, Face][]) {
      next[pos] = cur[from];
    }
    cur = next;
  }
  return cur;
}

function key(o: Orientation): string {
  return FACES.map((f) => o[f]).join('');
}

// Rotation component of a single move token: x/y/z themselves, wide moves
// (r = R + x, u = U + y, f = F + z, and their opposites), and slices
// (M = x', E = y', S = z). Face turns carry no rotation.
const ROTATION_OF: Record<string, { axis: 'x' | 'y' | 'z'; dir: 1 | -1 }> = {
  x: { axis: 'x', dir: 1 },
  y: { axis: 'y', dir: 1 },
  z: { axis: 'z', dir: 1 },
  r: { axis: 'x', dir: 1 },
  l: { axis: 'x', dir: -1 },
  u: { axis: 'y', dir: 1 },
  d: { axis: 'y', dir: -1 },
  f: { axis: 'z', dir: 1 },
  b: { axis: 'z', dir: -1 },
  M: { axis: 'x', dir: -1 },
  E: { axis: 'y', dir: -1 },
  S: { axis: 'z', dir: 1 },
};

function parseSuffix(suffix: string): number {
  // "" -> 1, "2" -> 2, "'" -> -1, "2'" -> -2, "3" -> 3 ...
  const m = suffix.match(/^(\d*)('?)$/);
  if (!m) return 1;
  const n = m[1] ? Number(m[1]) : 1;
  return m[2] ? -n : n;
}

function applyToken(o: Orientation, token: string): Orientation {
  if (token.startsWith('(')) {
    const close = token.lastIndexOf(')');
    const inner = token.slice(1, close);
    const count = parseSuffix(token.slice(close + 1));
    const groupNet = netOrientation(inner);
    const once = count < 0 ? invert(groupNet) : groupNet;
    let cur = o;
    for (let i = 0; i < Math.abs(count); i++) cur = compose(cur, once);
    return cur;
  }
  const m = token.match(/^([A-Za-z]+)(.*)$/);
  if (!m) return o;
  // "Rw" style wide moves map to their lowercase form.
  const base = m[1].endsWith('w') && m[1].length === 2 ? m[1][0].toLowerCase() : m[1];
  const rot = ROTATION_OF[base];
  if (!rot) return o;
  return rotate(o, rot.axis, rot.dir * parseSuffix(m[2]));
}

// Apply orientation `b` after `a`: positions in `b` refer to the frame `a`
// produced, so the content at position p is a[b[p]].
function compose(a: Orientation, b: Orientation): Orientation {
  const out = { ...IDENTITY };
  for (const pos of FACES) out[pos] = a[b[pos]];
  return out;
}

function invert(o: Orientation): Orientation {
  const out = { ...IDENTITY };
  for (const pos of FACES) out[o[pos]] = pos;
  return out;
}

// Net whole-cube rotation of an algorithm, as an orientation.
function netOrientation(algorithm: string): Orientation {
  return tokenizeAlg(algorithm).reduce(applyToken, IDENTITY);
}

// Shortest rotation sequence for each of the 24 orientations, found by BFS
// over the rotation tokens. Built lazily on first use.
let sequenceByKey: Map<string, string> | null = null;
const ROTATION_TOKENS = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];

function sequenceTable(): Map<string, string> {
  if (sequenceByKey) return sequenceByKey;
  const table = new Map<string, string>([[key(IDENTITY), '']]);
  let frontier: [Orientation, string][] = [[IDENTITY, '']];
  while (frontier.length > 0 && table.size < 24) {
    const next: [Orientation, string][] = [];
    for (const [o, seq] of frontier) {
      for (const tok of ROTATION_TOKENS) {
        const o2 = applyToken(o, tok);
        const k = key(o2);
        if (table.has(k)) continue;
        const s = seq ? `${seq} ${tok}` : tok;
        table.set(k, s);
        next.push([o2, s]);
      }
    }
    frontier = next;
  }
  sequenceByKey = table;
  return table;
}

// The rotation to append to `algorithm` so that the whole sequence leaves the
// cube in its original orientation. Empty string when no rotation is needed.
export function compensatingRotation(algorithm: string): string {
  const net = netOrientation(algorithm);
  return sequenceTable().get(key(invert(net))) ?? '';
}

// `algorithm` followed by the rotation that brings the cube back to its
// starting orientation.
export function rotationNeutral(algorithm: string): string {
  const rot = compensatingRotation(algorithm);
  const trimmed = algorithm.trim();
  if (!rot) return trimmed;
  return trimmed ? `${trimmed} ${rot}` : '';
}
