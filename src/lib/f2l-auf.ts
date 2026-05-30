import type { Auf } from '@/types/pll';

// F2L preset algorithms (from speedcubedb) write the AUF as a bare leading
// U / U2 / U' turn — e.g. "U R U' R'". Split that opening turn off into the
// AUF field, leaving the algorithm body. `U2'` is normalized to `U2`.
// Anything not starting with a bare U turn yields auf `U0` and an unchanged
// body (cube rotations, wide/slice moves, R/F/L starts, etc.).
export function splitF2LAuf(algorithm: string): { auf: Auf; rest: string } {
  const trimmed = algorithm.trim();
  const m = trimmed.match(/^(U2'|U2|U'|U)(?=\s|$)/);
  if (!m) return { auf: 'U0', rest: trimmed };
  const token = m[1];
  const auf: Auf = token === 'U2' || token === "U2'" ? 'U2' : token === "U'" ? "U'" : 'U';
  return { auf, rest: trimmed.slice(m[0].length).trim() };
}

// The cube move that realises an AUF, for prepending/appending to an alg
// string. `U0` is the identity (no move).
export function aufToMove(auf: Auf): string {
  return auf === 'U0' ? '' : auf;
}
