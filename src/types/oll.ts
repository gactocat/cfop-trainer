import type { Auf, TimeRecord } from './pll';

// SpeedCubeDB numbering, OLL 1 through OLL 57.
export type OLLId =
  | 'OLL-1' | 'OLL-2' | 'OLL-3' | 'OLL-4' | 'OLL-5' | 'OLL-6'
  | 'OLL-7' | 'OLL-8' | 'OLL-9' | 'OLL-10' | 'OLL-11' | 'OLL-12'
  | 'OLL-13' | 'OLL-14' | 'OLL-15' | 'OLL-16' | 'OLL-17' | 'OLL-18'
  | 'OLL-19' | 'OLL-20' | 'OLL-21' | 'OLL-22' | 'OLL-23' | 'OLL-24'
  | 'OLL-25' | 'OLL-26' | 'OLL-27' | 'OLL-28' | 'OLL-29' | 'OLL-30'
  | 'OLL-31' | 'OLL-32' | 'OLL-33' | 'OLL-34' | 'OLL-35' | 'OLL-36'
  | 'OLL-37' | 'OLL-38' | 'OLL-39' | 'OLL-40' | 'OLL-41' | 'OLL-42'
  | 'OLL-43' | 'OLL-44' | 'OLL-45' | 'OLL-46' | 'OLL-47' | 'OLL-48'
  | 'OLL-49' | 'OLL-50' | 'OLL-51' | 'OLL-52' | 'OLL-53' | 'OLL-54'
  | 'OLL-55' | 'OLL-56' | 'OLL-57';

export const OLL_IDS: OLLId[] = Array.from({ length: 57 }, (_, i) => `OLL-${i + 1}` as OLLId);

export type OLLCategory =
  | 'dot-case'
  | 'square-shapes'
  | 'lightning-shapes'
  | 'fish-shapes'
  | 'knight-move-shapes'
  | 'ocll'
  | 'all-corners-oriented'
  | 'awkward-shapes'
  | 'p-shapes'
  | 't-shapes'
  | 'c-shapes'
  | 'w-shapes'
  | 'l-shapes'
  | 'line-shapes';

export interface OLLDefinition {
  id: OLLId;
  name: string;
  number: number;
  category: OLLCategory;
  primaryAlg: string;
  setupAlg: string;
}

export interface OLLAlgorithmRecord {
  id: string;
  ollId: OLLId;
  auf: Auf;
  algorithm: string;
  times: TimeRecord[];
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OLLRandomSolve extends TimeRecord {
  ollId: OLLId;
}
