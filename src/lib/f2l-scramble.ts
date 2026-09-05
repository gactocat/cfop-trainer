import { F2L_SCRAMBLE_POOL } from '@/data/f2l-scramble-pool';
import { rotationNeutral } from '@/lib/cube-rotation';
import { aufFromMove, aufToMove, combineAuf, prefixAuf } from '@/lib/f2l-auf';
import { invertAlg } from '@/lib/invert-alg';
import { normalizeAlg } from '@/lib/normalize-alg';
import type { F2LId } from '@/types/f2l';
import { AUFS, type Auf } from '@/types/pll';

// The inverse-setup trainer's scramble is a random pick from a pre-generated
// pool of short setups that reach the case by a different route than the
// user's algorithm (see scripts/generate-f2l-scramble-pool.mts), so the
// solution cannot be read off the scramble while turning. The plain inverse
// of the algorithm is only used as a fallback when a case has no pool entry.
export interface F2LScrambleSettings {
  // Turn the U layer by a random amount on top of the case, so the case shows
  // up in a random orientation and the AUF has to be recognised, as it would
  // mid-solve. Applies to both trainer modes: it rotates the displayed case in
  // standard mode and is appended to the scramble in inverse-setup mode.
  randomAuf: boolean;
}

export const DEFAULT_F2L_SCRAMBLE_SETTINGS: F2LScrambleSettings = {
  randomAuf: true,
};

export interface F2LSetup {
  // Moves to apply to an F2L-solved cube to reach the case (with `uOffset`
  // already included).
  scramble: string;
  // The random U turn applied on top of the canonical case; U0 when the
  // random-orientation option is off.
  uOffset: Auf;
}

// Small deterministic PRNG (mulberry32). The trainer draws one seed per case
// and derives the setup from it, so it can be recomputed on re-render (e.g.
// after a settings change) without picking a new random one.
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

// The setup for `f2lId` given the user's `algorithm` (AUF + body). The
// scramble is applied to a cube with F2L solved; the last layer does not
// matter. An empty algorithm yields an empty scramble.
export function buildF2LSetup(
  f2lId: F2LId,
  algorithm: { auf: Auf; body: string },
  settings: F2LScrambleSettings,
  random: () => number = Math.random,
): F2LSetup {
  const full = prefixAuf(algorithm.auf, algorithm.body);
  // Draw the offset first so it does not depend on whether a pool exists.
  const uOffset: Auf = settings.randomAuf ? AUFS[Math.floor(random() * AUFS.length)] : 'U0';
  if (!full.trim()) return { scramble: '', uOffset };

  // Make the algorithm rotation-neutral before inverting, so an alg with a
  // leading y' (or a d, an unbalanced r, ...) still sets up the front-right
  // pair with the centers home instead of leaving the cube turned.
  const inverse = normalizeAlg(invertAlg(rotationNeutral(full)));
  const candidates = (F2L_SCRAMBLE_POOL[f2lId] ?? []).filter((s) => s !== inverse);
  const base =
    candidates.length > 0 ? candidates[Math.floor(random() * candidates.length)] : inverse;

  return { scramble: appendUTurn(base, uOffset), uOffset };
}

// Append a U turn, merging it with a trailing U turn so the scramble never
// ends in something like "U' U2".
function appendUTurn(scramble: string, turn: Auf): string {
  if (turn === 'U0') return scramble;
  const tokens = scramble.split(' ').filter(Boolean);
  const last = tokens[tokens.length - 1];
  const lastAuf = last === undefined ? undefined : aufFromMove(last);
  if (lastAuf) {
    tokens.pop();
    const merged = aufToMove(combineAuf(lastAuf, turn));
    if (merged) tokens.push(merged);
    return tokens.join(' ');
  }
  return [...tokens, aufToMove(turn)].join(' ');
}
