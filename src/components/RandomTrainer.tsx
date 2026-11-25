'use client';

import { useCallback, useMemo } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { usePllRandomSelection } from '@/hooks/usePllRandomSelection';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { prefixAuf } from '@/lib/f2l-auf';
import type { CaseTimes } from '@/lib/practice-log';
import { averageOfN, bestSeconds } from '@/lib/stats';
import { PLL_IDS, type AlgorithmRecord, type PllId } from '@/types/pll';
import { LastLayerRandomTrainer } from './LastLayerRandomTrainer';

// Every known algorithm for a case (with AUF prefix): the user's and the
// presets, used to vary the inverse setup.
function usePllAlternatives() {
  const { forPll } = useAlgorithms();
  return useCallback((id: PllId) => [
    ...forPll(id).map((r) => prefixAuf(r.auf, r.algorithm)),
    ...PRESET_ALGORITHMS[id].map((preset) => {
      const { auf, rest } = splitAuf(preset);
      return prefixAuf(auf, rest);
    }),
  ], [forPll]);
}

const nameFor = (id: PllId) => getPllDefinition(id)?.name ?? id;

export function RandomTrainer() {
  const { starredFor } = useAlgorithms();
  const alternativesFor = usePllAlternatives();
  const { selected } = usePllRandomSelection();
  return <LastLayerRandomTrainer
    practice="pll" ids={PLL_IDS} selected={selected}
    algorithmFor={(id) => {
      const star = starredFor(id);
      if (star) return star;
      const { auf, rest } = splitAuf(PRESET_ALGORITHMS[id][0]);
      return { auf, algorithm: rest };
    }}
    alternativesFor={alternativesFor}
    nameFor={nameFor}
  />;
}

// Practice of one algorithm from its case page: the same trainer with a
// single case, timed into that algorithm's times.
export function PllCaseTrainer({ record }: { record: AlgorithmRecord }) {
  const { addTime, removeTime } = useAlgorithms();
  const alternativesFor = usePllAlternatives();
  const { id, pllId, auf, algorithm, times } = record;
  const ids = useMemo(() => [pllId], [pllId]);
  const selected = useMemo(() => new Set([pllId]), [pllId]);
  const caseTimes = useMemo<CaseTimes>(() => ({
    add: (seconds) => addTime(id, seconds),
    remove: (timeId) => removeTime(id, timeId),
    best: bestSeconds(times),
    ao5: averageOfN(times, 5),
    count: times.length,
  }), [id, times, addTime, removeTime]);
  return <LastLayerRandomTrainer
    practice="pll" ids={ids} selected={selected} caseTimes={caseTimes}
    algorithmFor={() => ({ auf, algorithm })}
    alternativesFor={alternativesFor}
    nameFor={nameFor}
  />;
}
