'use client';

import { useMemo } from 'react';
import { getOLLDefinition } from '@/data/oll-definitions';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useOLLRandomSelection } from '@/hooks/useOLLRandomSelection';
import { useOLLRandomSolves } from '@/hooks/useOLLRandomSolves';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { prefixAuf } from '@/lib/f2l-auf';
import { OLL_IDS, type OLLId } from '@/types/oll';
import { LastLayerRandomTrainer } from './LastLayerRandomTrainer';

export function OLLRandomTrainer() {
  const solves = useOLLRandomSolves();
  const { starredFor, forOLL } = useOLLAlgorithms();
  const { selected } = useOLLRandomSelection();
  const lastRecorded = useMemo(() => {
    const map = new Map<OLLId, number>();
    for (const solve of solves.all) {
      const ts = Date.parse(solve.recordedAt);
      if (Number.isFinite(ts)) map.set(solve.ollId, Math.max(map.get(solve.ollId) ?? 0, ts));
    }
    return map;
  }, [solves.all]);
  return <LastLayerRandomTrainer
    practice="oll" ids={OLL_IDS} selected={selected} lastRecorded={lastRecorded}
    algorithmFor={(id) => {
      const star = starredFor(id);
      if (star) return star;
      const { auf, rest } = splitAuf(OLL_PRESET_ALGORITHMS[id][0]);
      return { auf, algorithm: rest };
    }}
    alternativesFor={(id) => [
      ...forOLL(id).map((r) => prefixAuf(r.auf, r.algorithm)),
      ...OLL_PRESET_ALGORITHMS[id].map((preset) => {
        const { auf, rest } = splitAuf(preset);
        return prefixAuf(auf, rest);
      }),
    ]}
    nameFor={(id) => getOLLDefinition(id)?.name ?? id}
    add={solves.add} bestFor={solves.bestFor} ao5For={solves.ao5For} solvesFor={solves.solvesFor}
  />;
}
