import { F2L_SCRAMBLE_POOL } from '@/data/f2l-scramble-pool';
import { rotationNeutral } from '@/lib/cube-rotation';
import { appendUTurn, prefixAuf } from '@/lib/f2l-auf';
import { invertAlg } from '@/lib/invert-alg';
import { normalizeAlg } from '@/lib/normalize-alg';
import type { F2LId } from '@/types/f2l';
import { caseOffset, type AufStart } from '@/lib/auf-start';
import type { Auf } from '@/types/pll';

// The inverse-setup trainer's scramble is a random pick from a pre-generated
// pool of short setups that reach the case by a different route than the
// user's algorithm (see scripts/generate-f2l-scramble-pool.mts), so the
// solution cannot be read off the scramble while turning. The plain inverse
// of the algorithm is only used as a fallback when a case has no pool entry.
//
// How the U layer is turned on top of the case (see AufStart): randomly, so
// the AUF has to be recognised as it would mid-solve; by the algorithm's AUF,
// so the body can start at once; or not at all. Applies to every mode: it
// rotates the displayed case and is appended to the setup scramble.

export interface F2LSetup {
  // Moves to apply to an F2L-solved cube to reach the case (with `uOffset`
  // already included).
  scramble: string;
  // The U turn applied on top of the canonical case (see AufStart).
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
  aufStart: AufStart,
  random: () => number = Math.random,
): F2LSetup {
  const full = prefixAuf(algorithm.auf, algorithm.body);
  // Draw the offset first so it does not depend on whether a pool exists.
  // The canonical case needs the algorithm's AUF first, so turning by it
  // leaves only the body to solve.
  const uOffset = caseOffset(aufStart, algorithm.auf, random);
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
