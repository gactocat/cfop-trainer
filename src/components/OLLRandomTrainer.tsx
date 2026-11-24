'use client';

import { useCallback, useMemo } from 'react';
import { getOLLDefinition } from '@/data/oll-definitions';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useOLLRandomSelection } from '@/hooks/useOLLRandomSelection';
import { useOLLRandomSolves } from '@/hooks/useOLLRandomSolves';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { prefixAuf } from '@/lib/f2l-auf';
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
  const solves = useOLLRandomSolves();
  const { starredFor } = useOLLAlgorithms();
  const alternativesFor = useOLLAlternatives();
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
    alternativesFor={alternativesFor}
    nameFor={nameFor}
    add={solves.add} remove={solves.remove} bestFor={solves.bestFor} ao5For={solves.ao5For} solvesFor={solves.solvesFor}
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
  const lastRecorded = useMemo(() => new Map<OLLId, number>(), []);
  return <LastLayerRandomTrainer
    practice="oll" ids={ids} selected={selected} lastRecorded={lastRecorded} single
    algorithmFor={() => ({ auf, algorithm })}
    alternativesFor={alternativesFor}
    nameFor={nameFor}
    add={(_case, seconds) => addTime(id, seconds)}
    remove={(timeId) => removeTime(id, timeId)}
    bestFor={() => bestSeconds(times)} ao5For={() => averageOfN(times, 5)} solvesFor={() => times}
  />;
}
