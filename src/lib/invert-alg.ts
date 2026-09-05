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

// Split an algorithm into tokens, keeping each parenthesised group — with any
// trailing modifier ('/2/repeat count) — as one token.
//   "(R U R') R2 (r' D r U2)5" -> ["(R U R')", "R2", "(r' D r U2)5"]
export function tokenizeAlg(algorithm: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < algorithm.length) {
    const ch = algorithm[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      let depth = 0;
      let j = i;
      for (; j < algorithm.length; j++) {
        if (algorithm[j] === '(') depth++;
        else if (algorithm[j] === ')' && --depth === 0) {
          j++;
          break;
        }
      }
      // Absorb a trailing modifier on the group (e.g. ')2", ")'", ")5").
      while (j < algorithm.length && /[0-9']/.test(algorithm[j])) j++;
      tokens.push(algorithm.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < algorithm.length && !/\s/.test(algorithm[j]) && algorithm[j] !== '(') j++;
      tokens.push(algorithm.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

// Invert one token. A parenthesised group keeps its parens and trailing
// modifier and has its body inverted in place — `(G)mod` -> `(invert(G))mod`,
// which is the correct inverse for plain groups, repeats and primed groups
// alike. A bare move is inverted directly.
function invertToken(token: string): string {
  if (token.startsWith('(')) {
    const close = token.lastIndexOf(')');
    const inner = token.slice(1, close);
    const suffix = token.slice(close + 1);
    return `(${invertAlg(inner)})${suffix}`;
  }
  return invertMove(token);
}

// Invert an algorithm: reverse the token order and invert each token, so that
// applying the result undoes the original sequence. Parenthesised groups are
// preserved as units. Empty / whitespace-only input yields an empty string.
//   "R U R' U' R U2"            -> "U2 R' U R U' R'"
//   "(R U R' U') R' F (R U R')" -> "(R U' R') F' R (U R U' R')"
export function invertAlg(algorithm: string): string {
  return tokenizeAlg(algorithm).reverse().map(invertToken).join(' ');
}
