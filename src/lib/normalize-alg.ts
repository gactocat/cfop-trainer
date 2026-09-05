// Canonical spelling used to compare move sequences: trimmed, single spaces,
// and `2'` written as `2` (a double turn is its own inverse).
export function normalizeAlg(algorithm: string): string {
  return algorithm
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/2'$/, '2'))
    .join(' ');
}
