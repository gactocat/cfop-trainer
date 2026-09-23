'use client';

import { useMemo } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { usePllRandomSelection } from '@/hooks/usePllRandomSelection';
import { useRandomSolves } from '@/hooks/useRandomSolves';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { prefixAuf } from '@/lib/f2l-auf';
import { PLL_IDS, type PllId } from '@/types/pll';
import { LastLayerRandomTrainer } from './LastLayerRandomTrainer';

export function RandomTrainer() {
  const solves = useRandomSolves();
  const { starredFor, forPll } = useAlgorithms();
  const { selected } = usePllRandomSelection();
  const lastRecorded = useMemo(() => {
    const map = new Map<PllId, number>();
    for (const solve of solves.all) {
      const ts = Date.parse(solve.recordedAt);
      if (Number.isFinite(ts)) map.set(solve.pllId, Math.max(map.get(solve.pllId) ?? 0, ts));
    }
    return map;
  }, [solves.all]);
  return <LastLayerRandomTrainer
    practice="pll" ids={PLL_IDS} selected={selected} lastRecorded={lastRecorded}
    algorithmFor={(id) => {
      const star = starredFor(id);
      if (star) return star;
      const { auf, rest } = splitAuf(PRESET_ALGORITHMS[id][0]);
      return { auf, algorithm: rest };
    }}
    alternativesFor={(id) => [
      ...forPll(id).map((r) => prefixAuf(r.auf, r.algorithm)),
      ...PRESET_ALGORITHMS[id].map((preset) => {
        const { auf, rest } = splitAuf(preset);
        return prefixAuf(auf, rest);
      }),
    ]}
    nameFor={(id) => getPllDefinition(id)?.name ?? id}
    add={solves.add} bestFor={solves.bestFor} ao5For={solves.ao5For} solvesFor={solves.solvesFor}
  />;
}
