// Invert a single move: toggle the prime, leaving a double turn unchanged.
//   R   -> R'      R'  -> R
//   U   -> U'      U'  -> U
//   R2  -> R2      U2' -> U2  (double turns are self-inverse)
// Works for any face/wide/slice/rotation token (Rw, M, x, ...).
function invertMove(move: string): string {
  if (move.endsWith("2'")) return move.slice(0, -1);
  if (move.endsWith('2')) return move;
  if (move.endsWith("'")) return move.slice(0, -1);
  return `${move}'`;
}

// Invert an algorithm: reverse the move order and invert each move, so that
// applying the result undoes the original sequence. Empty / whitespace-only
// input yields an empty string.
//   "R U R' U' R U2" -> "U2 R' U R U' R'"
export function invertAlg(algorithm: string): string {
  const moves = algorithm.trim().split(/\s+/).filter(Boolean);
  return moves.reverse().map(invertMove).join(' ');
}
