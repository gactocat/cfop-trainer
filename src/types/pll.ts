export type PllId =
  | 'Aa'
  | 'Ab'
  | 'E'
  | 'Ua'
  | 'Ub'
  | 'H'
  | 'Z'
  | 'Ja'
  | 'Jb'
  | 'T'
  | 'F'
  | 'Ra'
  | 'Rb'
  | 'V'
  | 'Y'
  | 'Na'
  | 'Nb'
  | 'Ga'
  | 'Gb'
  | 'Gc'
  | 'Gd';

export const PLL_IDS: PllId[] = [
  // Permutations of Edges Only
  'H', 'Ua', 'Ub', 'Z',
  // Permutations of Corners Only
  'Aa', 'Ab', 'E',
  // Permutations of Edges and Corners (alphabetical per wiki)
  'F', 'Ga', 'Gb', 'Gc', 'Gd',
  'Ja', 'Jb', 'Na', 'Nb',
  'Ra', 'Rb', 'T', 'V', 'Y',
];

export type Auf = 'U0' | 'U' | 'U2' | "U'";

export const AUFS: Auf[] = ['U0', 'U', 'U2', "U'"];

export type PllCategory = 'epll' | 'cpll' | 'ec-pll';

export interface PllDefinition {
  id: PllId;
  name: string;
  category: PllCategory;
}

export interface TimeRecord {
  id: string;
  seconds: number;
  recordedAt: string;
}

export interface AlgorithmRecord {
  id: string;
  pllId: PllId;
  auf: Auf;
  algorithm: string;
  times: TimeRecord[];
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

// One solve from the Random PLL trainer. Not associated with any algorithm
// string — just a per-PLL time bucket for the recognition-and-speed mode.
export interface RandomSolve {
  id: string;
  pllId: PllId;
  seconds: number;
  recordedAt: string;
}
