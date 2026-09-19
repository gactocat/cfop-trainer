import type { OLLDefinition, OLLId } from '@/types/oll';
import { OLL_PRESET_ALGORITHMS } from '@/data/oll-preset-algorithms';
import { rotationNeutral } from '@/lib/cube-rotation';
import { invertAlg } from '@/lib/invert-alg';

// Categories and numbering follow https://www.speedcubedb.com/a/3x3/OLL.
const CASES: Pick<OLLDefinition, 'id' | 'number' | 'category'>[] = [
  { id: 'OLL-1', number: 1, category: 'dot-case' },
  { id: 'OLL-2', number: 2, category: 'dot-case' },
  { id: 'OLL-3', number: 3, category: 'dot-case' },
  { id: 'OLL-4', number: 4, category: 'dot-case' },
  { id: 'OLL-5', number: 5, category: 'square-shapes' },
  { id: 'OLL-6', number: 6, category: 'square-shapes' },
  { id: 'OLL-7', number: 7, category: 'lightning-shapes' },
  { id: 'OLL-8', number: 8, category: 'lightning-shapes' },
  { id: 'OLL-9', number: 9, category: 'fish-shapes' },
  { id: 'OLL-10', number: 10, category: 'fish-shapes' },
  { id: 'OLL-11', number: 11, category: 'lightning-shapes' },
  { id: 'OLL-12', number: 12, category: 'lightning-shapes' },
  { id: 'OLL-13', number: 13, category: 'knight-move-shapes' },
  { id: 'OLL-14', number: 14, category: 'knight-move-shapes' },
  { id: 'OLL-15', number: 15, category: 'knight-move-shapes' },
  { id: 'OLL-16', number: 16, category: 'knight-move-shapes' },
  { id: 'OLL-17', number: 17, category: 'dot-case' },
  { id: 'OLL-18', number: 18, category: 'dot-case' },
  { id: 'OLL-19', number: 19, category: 'dot-case' },
  { id: 'OLL-20', number: 20, category: 'dot-case' },
  { id: 'OLL-21', number: 21, category: 'ocll' },
  { id: 'OLL-22', number: 22, category: 'ocll' },
  { id: 'OLL-23', number: 23, category: 'ocll' },
  { id: 'OLL-24', number: 24, category: 'ocll' },
  { id: 'OLL-25', number: 25, category: 'ocll' },
  { id: 'OLL-26', number: 26, category: 'ocll' },
  { id: 'OLL-27', number: 27, category: 'ocll' },
  { id: 'OLL-28', number: 28, category: 'all-corners-oriented' },
  { id: 'OLL-29', number: 29, category: 'awkward-shapes' },
  { id: 'OLL-30', number: 30, category: 'awkward-shapes' },
  { id: 'OLL-31', number: 31, category: 'p-shapes' },
  { id: 'OLL-32', number: 32, category: 'p-shapes' },
  { id: 'OLL-33', number: 33, category: 't-shapes' },
  { id: 'OLL-34', number: 34, category: 'c-shapes' },
  { id: 'OLL-35', number: 35, category: 'fish-shapes' },
  { id: 'OLL-36', number: 36, category: 'w-shapes' },
  { id: 'OLL-37', number: 37, category: 'fish-shapes' },
  { id: 'OLL-38', number: 38, category: 'w-shapes' },
  { id: 'OLL-39', number: 39, category: 'lightning-shapes' },
  { id: 'OLL-40', number: 40, category: 'lightning-shapes' },
  { id: 'OLL-41', number: 41, category: 'awkward-shapes' },
  { id: 'OLL-42', number: 42, category: 'awkward-shapes' },
  { id: 'OLL-43', number: 43, category: 'p-shapes' },
  { id: 'OLL-44', number: 44, category: 'p-shapes' },
  { id: 'OLL-45', number: 45, category: 't-shapes' },
  { id: 'OLL-46', number: 46, category: 'c-shapes' },
  { id: 'OLL-47', number: 47, category: 'l-shapes' },
  { id: 'OLL-48', number: 48, category: 'l-shapes' },
  { id: 'OLL-49', number: 49, category: 'l-shapes' },
  { id: 'OLL-50', number: 50, category: 'l-shapes' },
  { id: 'OLL-51', number: 51, category: 'line-shapes' },
  { id: 'OLL-52', number: 52, category: 'line-shapes' },
  { id: 'OLL-53', number: 53, category: 'l-shapes' },
  { id: 'OLL-54', number: 54, category: 'l-shapes' },
  { id: 'OLL-55', number: 55, category: 'line-shapes' },
  { id: 'OLL-56', number: 56, category: 'line-shapes' },
  { id: 'OLL-57', number: 57, category: 'all-corners-oriented' },
];

export const ALL_OLLS: OLLDefinition[] = CASES.map((def) => {
  const primaryAlg = OLL_PRESET_ALGORITHMS[def.id][0];
  return {
    ...def,
    name: `OLL ${def.number}`,
    primaryAlg,
    setupAlg: invertAlg(rotationNeutral(primaryAlg)),
  };
});

export function getOLLDefinition(id: OLLId): OLLDefinition | undefined {
  return ALL_OLLS.find((def) => def.id === id);
}
