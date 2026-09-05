import { F2L_SCRAMBLE_POOL } from '@/data/f2l-scramble-pool';
import { rotationNeutral } from '@/lib/cube-rotation';
import { prefixAuf } from '@/lib/f2l-auf';
import { invertAlg } from '@/lib/invert-alg';
import { normalizeAlg } from '@/lib/normalize-alg';
import type { F2LId } from '@/types/f2l';
import type { Auf } from '@/types/pll';

// The inverse-setup trainer's scramble is a random pick from a pre-generated
// pool of short setups that reach the case by a different route than the
// user's algorithm (see scripts/generate-f2l-scramble-pool.mts), so the
// solution cannot be read off the scramble while turning. The plain inverse
// of the algorithm is only used as a fallback when a case has no pool entry.
export interface F2LScrambleSettings {
  // Append a random U turn so the case also appears in a random U-layer
  // orientation, as it would mid-solve.
  randomAuf: boolean;
}

export const DEFAULT_F2L_SCRAMBLE_SETTINGS: F2LScrambleSettings = {
  randomAuf: true,
};

const AUF_MOVES = ['', 'U', 'U2', "U'"];

// Small deterministic PRNG (mulberry32). The trainer draws one seed per case
// and derives the scramble from it, so the scramble can be recomputed on
// re-render (e.g. after a settings change) without picking a new random one.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The scramble that sets up `f2lId` for `algorithm` (AUF + body). Applied to a
// cube with F2L solved; the last layer does not matter. Returns '' when there
// is nothing to set up.
export function buildF2LScramble(
  f2lId: F2LId,
  algorithm: { auf: Auf; body: string },
  settings: F2LScrambleSettings,
  random: () => number = Math.random,
): string {
  const full = prefixAuf(algorithm.auf, algorithm.body);
  if (!full.trim()) return '';
  // Make the algorithm rotation-neutral before inverting, so an alg with a
  // leading y' (or a d, an unbalanced r, ...) still sets up the front-right
  // pair with the centers home instead of leaving the cube turned.
  const inverse = normalizeAlg(invertAlg(rotationNeutral(full)));

  const candidates = (F2L_SCRAMBLE_POOL[f2lId] ?? []).filter((s) => s !== inverse);
  let scramble =
    candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)] : inverse;

  if (settings.randomAuf) {
    scramble = appendUTurn(scramble, AUF_MOVES[Math.floor(random() * AUF_MOVES.length)]);
  }
  return scramble;
}

const U_QUARTER_TURNS: Record<string, number> = { U: 1, U2: 2, "U'": 3 };
const U_FROM_QUARTER_TURNS = ['', 'U', 'U2', "U'"];

// Append a U turn, merging it with a trailing U turn so the scramble never
// ends in something like "U' U2".
function appendUTurn(scramble: string, turn: string): string {
  if (!turn) return scramble;
  const tokens = scramble.split(' ').filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (last !== undefined && last in U_QUARTER_TURNS) {
    const merged = U_FROM_QUARTER_TURNS[(U_QUARTER_TURNS[last] + U_QUARTER_TURNS[turn]) % 4];
    tokens.pop();
    if (merged) tokens.push(merged);
    return tokens.join(' ');
  }
  return [...tokens, turn].join(' ');
}
