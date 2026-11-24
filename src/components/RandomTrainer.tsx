'use client';

import { useCallback, useMemo } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { PRESET_ALGORITHMS } from '@/data/preset-algorithms';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { usePllRandomSelection } from '@/hooks/usePllRandomSelection';
import { useRandomSolves } from '@/hooks/useRandomSolves';
import { splitAuf } from '@/lib/auf-from-algorithm';
import { prefixAuf } from '@/lib/f2l-auf';
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
  const solves = useRandomSolves();
  const { starredFor } = useAlgorithms();
  const alternativesFor = usePllAlternatives();
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
    alternativesFor={alternativesFor}
    nameFor={nameFor}
    add={solves.add} remove={solves.remove} bestFor={solves.bestFor} ao5For={solves.ao5For} solvesFor={solves.solvesFor}
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
  const lastRecorded = useMemo(() => new Map<PllId, number>(), []);
  return <LastLayerRandomTrainer
    practice="pll" ids={ids} selected={selected} lastRecorded={lastRecorded} single
    algorithmFor={() => ({ auf, algorithm })}
    alternativesFor={alternativesFor}
    nameFor={nameFor}
    add={(_case, seconds) => addTime(id, seconds)}
    remove={(timeId) => removeTime(id, timeId)}
    bestFor={() => bestSeconds(times)} ao5For={() => averageOfN(times, 5)} solvesFor={() => times}
  />;
}
