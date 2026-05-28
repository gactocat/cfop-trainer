import type { F2LCategory, F2LDefinition, F2LId } from '@/types/f2l';
import { F2L_IDS } from '@/types/f2l';

// Source: speedcubedb.com/a/3x3/F2L (Front-Right orientation).
// `setupAlg` displays the case from a solved cube; `primaryAlg` is the
// top-voted solving algorithm. Both are taken verbatim from the site.
interface RawDefinition {
  number: number;
  category: F2LCategory;
  setup: string;
  primary: string;
}

const RAW: RawDefinition[] = [
  { number: 1, category: 'easy', setup: "F R' F' R", primary: "U R U' R'" },
  { number: 2, category: 'easy', setup: "R' F R F'", primary: "F R' F' R" },
  { number: 3, category: 'easy', setup: "F' U F", primary: "F' U' F" },
  { number: 4, category: 'easy', setup: "R U' R'", primary: "R U R'" },
  { number: 5, category: 'disconnected', setup: "R U R' U2' R U' R' U", primary: "U' R U R' U2 R U' R'" },
  { number: 6, category: 'disconnected', setup: "F' U' F U2' F' U F U'", primary: "U' r U' R' U R U r'" },
  { number: 7, category: 'disconnected', setup: "R U R' U2' R U2' R' U", primary: "U' R U2 R' U' R U2 R'" },
  { number: 8, category: 'disconnected', setup: "r' U' R2 U' R2' U2' r", primary: "d R' U2 R U R' U2 R" },
  { number: 9, category: 'disconnected', setup: "F' U F U' R U R' U", primary: "U' R U' R' U F' U' F" },
  { number: 10, category: 'disconnected', setup: "R U' R' U' R U' R' U", primary: "U' R U R' U R U R'" },
  { number: 11, category: 'connected', setup: "F' U F U' R U2' R' U", primary: "U' R U2 R' U F' U' F" },
  { number: 12, category: 'connected', setup: "R U R' U2' R U R' U' R U R'", primary: "R U' R' U R U' R' U2 R U' R'" },
  { number: 13, category: 'connected', setup: "r U2' R' U R U' R' U M", primary: "y' U R' U R U' R' U' R" },
  { number: 14, category: 'connected', setup: "R U' R' U' R U R' U", primary: "U' R U' R' U R U R'" },
  { number: 15, category: 'connected', setup: "R U R' U' R U R' U2' R U' R'", primary: "R' D' R U' R' D R U R U' R'" },
  { number: 16, category: 'connected', setup: "F' U F U2' R U R'", primary: "R U' R' U2 F' U' F" },
  { number: 17, category: 'connected', setup: "R U' R' U R U2' R'", primary: "R U2 R' U' R U R'" },
  { number: 18, category: 'connected', setup: "R U R' U' R U R' F R' F' R", primary: "y' R' U2 R U R' U' R" },
  { number: 19, category: 'disconnected', setup: "R U R' U' R U2' R' U'", primary: "U R U2 R' U R U' R'" },
  { number: 20, category: 'disconnected', setup: "R U R' F R' F' R2' U R' U", primary: "y' U' R' U2 R U' R' U R" },
  { number: 21, category: 'disconnected', setup: "R U' R' U2' R U R'", primary: "U2 R U R' U R U' R'" },
  { number: 22, category: 'disconnected', setup: "F' L' U2' L F", primary: "r U' r' U2 r U r'" },
  { number: 23, category: 'connected', setup: "R U' R' U R U' R' U2' R U' R'", primary: "U R U' R' U' R U' R' U R U' R'" },
  { number: 24, category: 'connected', setup: "R U R' F R U R' U' F'", primary: "F U R U' R' F' R U' R'" },
  { number: 25, category: 'corner-in-slot', setup: "F' R U R' U' R' F R", primary: "U' R' F R F' R U R'" },
  { number: 26, category: 'corner-in-slot', setup: "F' U' F U R U R' U'", primary: "U R U' R' F R' F' R" },
  { number: 27, category: 'corner-in-slot', setup: "R U R' U' R U R'", primary: "R U' R' U R U' R'" },
  { number: 28, category: 'corner-in-slot', setup: "R' F R F' U R U' R'", primary: "R U R' U' F R' F' R" },
  { number: 29, category: 'corner-in-slot', setup: "F R' F' R F R' F' R", primary: "R' F R F' U R U' R'" },
  { number: 30, category: 'corner-in-slot', setup: "R U' R' U R U' R'", primary: "R U R' U' R U R'" },
  { number: 31, category: 'edge-in-slot', setup: "R U R' F R' F' R U", primary: "U' R' F R F' R U' R'" },
  { number: 32, category: 'edge-in-slot', setup: "R U' R' U R U' R' U R U' R'", primary: "U R U' R' U R U' R' U R U' R'" },
  { number: 33, category: 'edge-in-slot', setup: "R U R' U2' R U R' U", primary: "U' R U' R' U2 R U' R'" },
  { number: 34, category: 'edge-in-slot', setup: "R U' R' U2' R U' R' U'", primary: "U R U R' U2 R U R'" },
  { number: 35, category: 'edge-in-slot', setup: "F' U F U' R U' R' U", primary: "U' R U R' U F' U' F" },
  { number: 36, category: 'edge-in-slot', setup: "R U' R' U2' F R' F' R U2'", primary: "U F' U' F U' R U R'" },
  { number: 37, category: 'pieces-in-slot', setup: "R U' R U2' F R2' F' U2' R2'", primary: "R2 U2 F R2 F' U2 R' U R'" },
  { number: 38, category: 'pieces-in-slot', setup: "R U' R' U R U2' R' U R U' R'", primary: "R U' R' U' R U R' U2 R U' R'" },
  { number: 39, category: 'pieces-in-slot', setup: "R U' R' U' R U R' U2' R U' R'", primary: "R U' R' U R U2 R' U R U' R'" },
  { number: 40, category: 'pieces-in-slot', setup: "R U R' F U R U' R' F' R U R'", primary: "r U' r' U2 r U r' R U R'" },
  { number: 41, category: 'pieces-in-slot', setup: "R F U R U' R' F' U' R'", primary: "R U' R' r U' r' U2 r U r'" },
];

function buildDefinition(raw: RawDefinition): F2LDefinition {
  return {
    id: `F2L-${raw.number}` as F2LId,
    number: raw.number,
    category: raw.category,
    setupAlg: raw.setup,
    primaryAlg: raw.primary,
  };
}

export const F2L_DEFINITIONS: Record<F2LId, F2LDefinition> = RAW.reduce(
  (acc, raw) => {
    const def = buildDefinition(raw);
    acc[def.id] = def;
    return acc;
  },
  {} as Record<F2LId, F2LDefinition>,
);

export const ALL_F2LS: F2LDefinition[] = F2L_IDS.map((id) => F2L_DEFINITIONS[id]);

export function getF2LDefinition(id: F2LId): F2LDefinition | undefined {
  return F2L_DEFINITIONS[id];
}

export const F2L_CATEGORY_ORDER: F2LCategory[] = [
  'easy',
  'disconnected',
  'connected',
  'corner-in-slot',
  'edge-in-slot',
  'pieces-in-slot',
];

export const F2L_CATEGORY_LABELS: Record<F2LCategory, string> = {
  easy: 'Easy / Free Pairs',
  disconnected: 'Disconnected Pairs',
  connected: 'Connected Pairs',
  'corner-in-slot': 'Corner in Slot',
  'edge-in-slot': 'Edge in Slot',
  'pieces-in-slot': 'Pieces in Slot',
};
