import { tokenizeAlg } from '@/lib/invert-alg';
import type { Auf } from '@/types/pll';

// Moves in an algorithm as a smart cube counts them: each face or wide turn
// is one (a half turn too), a slice turn is two (the cube sees both outer
// faces turn), and rotations are none. Groups count their moves times their
// repeat count: "(R U R' U')2" is 8.
export function countMoves(algorithm: string): number {
  let count = 0;
  for (const token of tokenizeAlg(algorithm)) {
    if (token.startsWith('(')) {
      const close = token.lastIndexOf(')');
      const repeat = Number.parseInt(token.slice(close + 1).replace(/'/g, ''), 10);
      count += countMoves(token.slice(1, close)) * (Number.isFinite(repeat) && repeat > 0 ? repeat : 1);
      continue;
    }
    const family = /^\d*([A-Za-z]+)/.exec(token)?.[1];
    if (!family || /^[xyz]$/.test(family)) continue;
    count += /^[MES]$/.test(family) ? 2 : 1;
  }
  return count;
}

/** The moves to solve a shown case: the AUF needed first (one turn, if any), then the algorithm. */
export function solutionMoves(auf: Auf, algorithm: string): number | null {
  const moves = countMoves(algorithm);
  if (moves === 0) return null;
  return moves + (auf === 'U0' ? 0 : 1);
}

/** Moves per second, to two decimals. */
export function movesPerSecond(moves: number, seconds: number): number | null {
  return seconds > 0 ? Math.round((moves / seconds) * 100) / 100 : null;
}
