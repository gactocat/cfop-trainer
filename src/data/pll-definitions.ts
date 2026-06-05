import type { PllCategory, PllDefinition, PllId } from '@/types/pll';
import { PLL_IDS } from '@/types/pll';

// ---------------------------------------------------------------------------
// Coordinate convention (top view, looking down the U axis)
//
//   Corners (CW from back-left): 0=UBL, 1=UBR, 2=UFR, 3=UFL
//   Edges   (CW from back):      0=UB,  1=UR,  2=UF,  3=UL
//
// ---------------------------------------------------------------------------
// PLL permutations as cycles in our index convention.
// Cycle [a, b, c] means: piece at a -> b -> c -> a (algorithm direction).
// In the SCRAMBLED state shown in the diagram, position a contains the b-piece
// (because the algorithm will move it from a to b to solve the cube).
// ---------------------------------------------------------------------------

interface PllCycles {
  corners: number[][];
  edges: number[][];
}

// Cycles below are derived from speedsolving.com PLL diagrams (the wiki PDF).
// Indexing: corners 0=UBL, 1=UBR, 2=UFR, 3=UFL; edges 0=UB, 1=UR, 2=UF, 3=UL.
// Cycle [a,b,c] = piece at a moves to b after the algorithm
// (so in the scrambled state shown, position a holds the b-piece).
const PLL_CYCLES: Record<PllId, PllCycles> = {
  // Permutations of Edges Only (EPLL)
  H:  { corners: [], edges: [[0, 2], [1, 3]] },                  // (UB UF)(UR UL)
  Ua: { corners: [], edges: [[0, 3, 1]] },                       // (UB UL UR), leaves UF
  Ub: { corners: [], edges: [[0, 1, 3]] },                       // (UB UR UL), leaves UF
  Z:  { corners: [], edges: [[0, 3], [1, 2]] },                  // (UB UL)(UR UF)

  // Permutations of Corners Only (CPLL)
  Aa: { corners: [[1, 2, 3]], edges: [] },                       // (UBR UFR UFL), leaves UBL
  Ab: { corners: [[1, 3, 2]], edges: [] },                       // (UBR UFL UFR), leaves UBL
  E:  { corners: [[0, 1], [2, 3]], edges: [] },                  // (UBL UBR)(UFR UFL) — adjacent pairs per wiki diagram

  // Permutations of Edges and Corners
  F:  { corners: [[0, 1]],         edges: [[1, 3]] },            // (UBL UBR) + (UR UL)
  Ga: { corners: [[0, 2, 3]],      edges: [[0, 3, 2]] },         // (UBL UFR UFL) + (UB UL UF)
  Gb: { corners: [[0, 3, 2]],      edges: [[0, 2, 3]] },         // (UBL UFL UFR) + (UB UF UL)
  Gc: { corners: [[1, 3, 2]],      edges: [[0, 1, 2]] },         // (UBR UFL UFR) + (UB UR UF)
  Gd: { corners: [[1, 2, 3]],      edges: [[0, 2, 1]] },         // (UBR UFR UFL) + (UB UF UR)
  Ja: { corners: [[0, 3]],         edges: [[2, 3]] },            // (UBL UFL) + (UF UL)
  Jb: { corners: [[1, 2]],         edges: [[1, 2]] },            // (UBR UFR) + (UR UF)
  Na: { corners: [[1, 3]],         edges: [[1, 3]] },            // (UBR UFL) + (UR UL)
  Nb: { corners: [[0, 2]],         edges: [[1, 3]] },            // (UBL UFR) + (UR UL)
  Ra: { corners: [[2, 3]],         edges: [[0, 1]] },            // (UFR UFL) + (UB UR)
  Rb: { corners: [[0, 1]],         edges: [[1, 2]] },            // (UBL UBR) + (UR UF)
  T:  { corners: [[1, 2]],         edges: [[1, 3]] },            // (UBR UFR) + (UR UL)
  V:  { corners: [[0, 2]],         edges: [[0, 1]] },            // (UBL UFR) + (UB UR)
  Y:  { corners: [[0, 2]],         edges: [[0, 3]] },            // (UBL UFR) + (UB UL)
};

const NAMES: Record<PllId, string> = {
  Aa: 'Aa Perm',
  Ab: 'Ab Perm',
  E: 'E Perm',
  Ua: 'Ua Perm',
  Ub: 'Ub Perm',
  H: 'H Perm',
  Z: 'Z Perm',
  Ja: 'Ja Perm',
  Jb: 'Jb Perm',
  T: 'T Perm',
  F: 'F Perm',
  Ra: 'Ra Perm',
  Rb: 'Rb Perm',
  V: 'V Perm',
  Y: 'Y Perm',
  Na: 'Na Perm',
  Nb: 'Nb Perm',
  Ga: 'Ga Perm',
  Gb: 'Gb Perm',
  Gc: 'Gc Perm',
  Gd: 'Gd Perm',
};

const CATEGORIES: Record<PllId, PllCategory> = {
  H: 'epll', Ua: 'epll', Ub: 'epll', Z: 'epll',
  Aa: 'cpll', Ab: 'cpll', E: 'cpll',
  F: 'ec-pll', Ga: 'ec-pll', Gb: 'ec-pll', Gc: 'ec-pll', Gd: 'ec-pll',
  Ja: 'ec-pll', Jb: 'ec-pll', Na: 'ec-pll', Nb: 'ec-pll',
  Ra: 'ec-pll', Rb: 'ec-pll', T: 'ec-pll', V: 'ec-pll', Y: 'ec-pll',
};

// Apply a list of disjoint cycles to an identity permutation [0,1,...,n-1].
// Cycle [a,b,c] sets arr[a]=b, arr[b]=c, arr[c]=a.
function applyCycles(n: number, cycles: number[][]): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (const cycle of cycles) {
    const len = cycle.length;
    for (let i = 0; i < len; i++) {
      arr[cycle[i]] = cycle[(i + 1) % len];
    }
  }
  return arr;
}

function buildDefinition(id: PllId): PllDefinition {
  return {
    id,
    name: NAMES[id],
    category: CATEGORIES[id],
  };
}

export const PLL_DEFINITIONS: Record<PllId, PllDefinition> = PLL_IDS.reduce(
  (acc, id) => {
    acc[id] = buildDefinition(id);
    return acc;
  },
  {} as Record<PllId, PllDefinition>,
);

export const ALL_PLLS: PllDefinition[] = PLL_IDS.map((id) => PLL_DEFINITIONS[id]);

export function getPllDefinition(id: PllId): PllDefinition | undefined {
  return PLL_DEFINITIONS[id];
}

// Permutation of the U-layer in our index convention, used to drive the
// cubing.js LL visualization. `cornerAt[i]` / `edgeAt[i]` give the home index
// of the piece sitting at position i in the scrambled (pre-solve) state.
//   Corners: 0=UBL, 1=UBR, 2=UFR, 3=UFL
//   Edges:   0=UB,  1=UR,  2=UF,  3=UL
export function getPllPermutation(
  id: PllId,
): { cornerAt: number[]; edgeAt: number[] } {
  const cycles = PLL_CYCLES[id];
  return {
    cornerAt: applyCycles(4, cycles.corners),
    edgeAt: applyCycles(4, cycles.edges),
  };
}
