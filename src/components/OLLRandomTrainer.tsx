'use client';

import { useCallback, useMemo } from 'react';
import { getOLLDefinition } from '@/data/oll-definitions';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useOLLRandomSelection } from '@/hooks/useOLLRandomSelection';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { prefixAuf } from '@/lib/f2l-auf';
import type { CaseTimes } from '@/lib/practice-log';
import { averageOfN, bestSeconds } from '@/lib/stats';
import { OLL_IDS, type OLLAlgorithmRecord, type OLLId } from '@/types/oll';
import { LastLayerRandomTrainer } from './LastLayerRandomTrainer';

// Every known algorithm for a case (with AUF prefix): the user's and the
// presets, used to vary the inverse setup.
function useOLLAlternatives() {
  const { forOLL } = useOLLAlgorithms();
  return useCallback((id: OLLId) => [
    ...forOLL(id).map((r) => prefixAuf(r.auf, r.algorithm)),
    ...OLL_PRESET_ALGORITHMS[id].map((preset) => {
      const { auf, rest } = splitAuf(preset);
      return prefixAuf(auf, rest);
    }),
  ], [forOLL]);
}

const nameFor = (id: OLLId) => getOLLDefinition(id)?.name ?? id;

export function OLLRandomTrainer() {
  const { starredFor } = useOLLAlgorithms();
  const alternativesFor = useOLLAlternatives();
  const { selected } = useOLLRandomSelection();
  return <LastLayerRandomTrainer
    practice="oll" ids={OLL_IDS} selected={selected}
    algorithmFor={(id) => {
      const star = starredFor(id);
      if (star) return star;
      const { auf, rest } = splitAuf(OLL_PRESET_ALGORITHMS[id][0]);
      return { auf, algorithm: rest };
    }}
    alternativesFor={alternativesFor}
    nameFor={nameFor}
  />;
}

// Practice of one algorithm from its case page: the same trainer with a
// single case, timed into that algorithm's times.
export function OLLCaseTrainer({ record }: { record: OLLAlgorithmRecord }) {
  const { addTime, removeTime } = useOLLAlgorithms();
  const alternativesFor = useOLLAlternatives();
  const { id, ollId, auf, algorithm, times } = record;
  const ids = useMemo(() => [ollId], [ollId]);
  const selected = useMemo(() => new Set([ollId]), [ollId]);
  const caseTimes = useMemo<CaseTimes>(() => ({
    add: (seconds) => addTime(id, seconds),
    remove: (timeId) => removeTime(id, timeId),
    best: bestSeconds(times),
    ao5: averageOfN(times, 5),
    count: times.length,
  }), [id, times, addTime, removeTime]);
  return <LastLayerRandomTrainer
    practice="oll" ids={ids} selected={selected} caseTimes={caseTimes}
    algorithmFor={() => ({ auf, algorithm })}
    alternativesFor={alternativesFor}
    nameFor={nameFor}
  />;
}
