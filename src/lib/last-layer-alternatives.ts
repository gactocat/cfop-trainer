import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { rotationNeutral } from '@/lib/cube-rotation';
import { aufFromMove, appendUTurn, prependUTurn } from '@/lib/f2l-auf';
import { invertAlg } from '@/lib/invert-alg';
import { normalizeAlg } from '@/lib/normalize-alg';
import type { LastLayerPractice } from '@/types/practice';
import { AUFS, type Auf } from '@/types/pll';

// The inverse-setup trainer hides the starred algorithm by setting the case up
// with the inverse of another algorithm for the same case (the user's other
// algorithms or the presets). Two algorithms for one case can differ by a U
// turn before and after, so each inverse is wrapped in the U turns that make
// it reach exactly the state the starred algorithm solves. For OLL only the
// orientation has to match; the permutation left behind is a free PLL.
//
// Checking needs a cube model, so cubing.js's kpuzzle is loaded on demand.

let kpuzzle: KPuzzle | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function subscribeLastLayerSolver(listener: () => void): () => void {
  listeners.add(listener);
  loading ??= import('cubing/puzzles')
    .then(({ cube3x3x3 }) => cube3x3x3.kpuzzle())
    .then((loaded) => {
      kpuzzle = loaded;
      for (const l of listeners) l();
    })
    .catch(() => {
      // Keep the plain inverse; allow a retry on the next subscription.
      loading = null;
    });
  return () => listeners.delete(listener);
}

export const getLastLayerSolver = (): KPuzzle | null => kpuzzle;
export const getServerLastLayerSolver = (): KPuzzle | null => null;

type Orbit = 'CORNERS' | 'EDGES';
const ORBITS: Orbit[] = ['CORNERS', 'EDGES'];
// The first four pieces of each orbit are the U layer in cubing.js.
const LL_SIZE = 4;

function equalFrom(a: number[], b: number[], from: number): boolean {
  for (let i = from; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameCase(practice: LastLayerPractice, a: KPattern, b: KPattern): boolean {
  if (!equalFrom(a.patternData.CENTERS.pieces, b.patternData.CENTERS.pieces, 0)) return false;
  return ORBITS.every((orbit) => {
    const x = a.patternData[orbit];
    const y = b.patternData[orbit];
    return (
      equalFrom(x.pieces, y.pieces, practice === 'oll' ? LL_SIZE : 0) &&
      equalFrom(x.orientation, y.orientation, 0)
    );
  });
}

// The sequence without its outer U turns, so the same algorithm is recognised
// whichever AUF it was written or wrapped with.
function core(alg: string): string {
  const tokens = normalizeAlg(alg).split(' ');
  while (tokens.length && aufFromMove(tokens[0])) tokens.shift();
  while (tokens.length && aufFromMove(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

// Setups that reach the same case as `inverse` (the plain inverse of the
// solution the trainer will show), one per usable alternative, in the order
// given. Alternatives that do not solve the case, fail to parse, or produce
// the starred algorithm itself are skipped. `limit` stops early once enough are found.
export function alternativeSetups(
  solver: KPuzzle,
  practice: LastLayerPractice,
  inverse: string,
  alternatives: readonly string[],
  limit = Infinity,
): string[] {
  const solved = solver.defaultPattern();
  let target: KPattern;
  try {
    target = solved.applyAlg(inverse);
  } catch {
    return [];
  }
  const found = new Set<string>();
  // Neither the inverse nor the solution itself (self-inverse cases such as
  // the T perm turn an alternative's inverse into the starred algorithm).
  const revealing = new Set([core(inverse), core(invertAlg(inverse))]);
  // A U turn before the setup only permutes the last layer, which OLL ignores.
  const before: readonly Auf[] = practice === 'pll' ? AUFS : ['U0'];
  for (const alternative of alternatives) {
    if (found.size >= limit) break;
    let body: string;
    try {
      body = invertAlg(rotationNeutral(alternative));
    } catch {
      continue;
    }
    if (revealing.has(core(body))) continue;
    search: for (const pre of before) {
      for (const post of AUFS) {
        const candidate = normalizeAlg(appendUTurn(prependUTurn(body, pre), post));
        if (!candidate) continue;
        try {
          if (!sameCase(practice, solved.applyAlg(candidate), target)) continue;
        } catch {
          break search;
        }
        found.add(candidate);
        break search;
      }
    }
  }
  return [...found];
}

// One random alternative setup, or `inverse` when none is usable (no solver
// yet, or no other algorithm for the case).
export function pickAlternativeSetup(
  solver: KPuzzle | null,
  practice: LastLayerPractice,
  inverse: string,
  alternatives: readonly string[],
  random: () => number = Math.random,
): string {
  if (!solver) return inverse;
  // Shuffle first, then stop at the first usable one: cheaper than checking
  // every alternative on each pick.
  const shuffled = [...alternatives];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return alternativeSetups(solver, practice, inverse, shuffled, 1)[0] ?? inverse;
}
