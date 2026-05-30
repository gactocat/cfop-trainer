import type { Auf, TimeRecord } from './pll';

// All 41 F2L cases, numbered as they appear on speedcubedb.com/a/3x3/F2L.
// The Front-Right slot is the canonical position; orientation rotations
// (Front-Left etc.) are handled by the solver's `y` rotations during a real
// solve, so we only store the FR variant.
export type F2LId =
  | 'F2L-1' | 'F2L-2' | 'F2L-3' | 'F2L-4' | 'F2L-5'
  | 'F2L-6' | 'F2L-7' | 'F2L-8' | 'F2L-9' | 'F2L-10'
  | 'F2L-11' | 'F2L-12' | 'F2L-13' | 'F2L-14' | 'F2L-15'
  | 'F2L-16' | 'F2L-17' | 'F2L-18' | 'F2L-19' | 'F2L-20'
  | 'F2L-21' | 'F2L-22' | 'F2L-23' | 'F2L-24' | 'F2L-25'
  | 'F2L-26' | 'F2L-27' | 'F2L-28' | 'F2L-29' | 'F2L-30'
  | 'F2L-31' | 'F2L-32' | 'F2L-33' | 'F2L-34' | 'F2L-35'
  | 'F2L-36' | 'F2L-37' | 'F2L-38' | 'F2L-39' | 'F2L-40'
  | 'F2L-41';

export const F2L_IDS: F2LId[] = Array.from({ length: 41 }, (_, i) => `F2L-${i + 1}` as F2LId);

export type F2LCategory =
  | 'easy'
  | 'disconnected'
  | 'connected'
  | 'corner-in-slot'
  | 'edge-in-slot'
  | 'pieces-in-slot';

export interface F2LDefinition {
  id: F2LId;
  number: number;
  category: F2LCategory;
  setupAlg: string;   // Applied to a solved cube to display the case.
  primaryAlg: string; // The first-listed (recommended) solving algorithm.
}

export interface F2LAlgorithmRecord {
  id: string;
  f2lId: F2LId;
  // U-face adjustment done before the algorithm body. The body (`algorithm`)
  // is stored without its leading U turn — that turn lives here.
  auf: Auf;
  algorithm: string;
  times: TimeRecord[];
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface F2LRandomSolve {
  id: string;
  f2lId: F2LId;
  seconds: number;
  recordedAt: string;
}
