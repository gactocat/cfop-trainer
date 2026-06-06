// Pick an id from `ids`, biased toward cases whose most recent solve is the
// oldest — the longer since a case was last timed, the likelier it reappears.
// Recency comes from `lastRecordedAt` (epoch ms of the latest solve for an id,
// or undefined when never timed). Never-timed cases are treated as maximally
// stale. Weight grows linearly with staleness but is capped, so a long-
// neglected case can't crowd everything else out — every eligible case keeps a
// real chance, preserving the randomness of the draw.

const DAY_MS = 86_400_000;
const MAX_AGE_DAYS = 30;

export function pickStaleWeighted<T extends string>(
  ids: readonly T[],
  lastRecordedAt: (id: T) => number | undefined,
  now: number,
  rand: number = Math.random(),
): T {
  const weights = ids.map((id) => {
    const last = lastRecordedAt(id);
    const ageDays = last === undefined ? MAX_AGE_DAYS : (now - last) / DAY_MS;
    return 1 + Math.min(Math.max(ageDays, 0), MAX_AGE_DAYS);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let threshold = rand * total;
  for (let i = 0; i < ids.length; i += 1) {
    threshold -= weights[i];
    if (threshold < 0) return ids[i];
  }
  return ids[ids.length - 1];
}
