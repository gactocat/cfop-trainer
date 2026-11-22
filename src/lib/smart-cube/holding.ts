// How the user holds the cube, relative to the smart cube's own frame (white
// on U, green on F). A frame maps each position the user sees to the cube face
// sitting there; face turns keep their direction under any rotation.

import type { Amount, Face, LastLayerFace } from '@/lib/smart-cube/cube-state';

export type CubeHolding = 'yellow-blue' | 'yellow-green' | 'white-green';
export const CUBE_HOLDINGS: readonly CubeHolding[] = ['yellow-blue', 'yellow-green', 'white-green'];
/** Yellow on top, blue in front: the orientation of the app's 3D views (x2). */
export const DEFAULT_HOLDING: CubeHolding = 'yellow-blue';

export type Frame = Readonly<Record<Face, Face>>;

const HOLDING_FRAMES: Record<CubeHolding, Frame> = {
  'yellow-blue': { U: 'D', R: 'R', F: 'B', D: 'U', L: 'L', B: 'F' },
  'yellow-green': { U: 'D', R: 'L', F: 'F', D: 'U', L: 'R', B: 'B' },
  'white-green': { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' },
};

export const holdingFrame = (holding: CubeHolding): Frame => HOLDING_FRAMES[holding];

/** The cube face that is the last layer (the face on top) when held this way. */
export const lastLayerFace = (holding: CubeHolding): LastLayerFace => HOLDING_FRAMES[holding].U as LastLayerFace;

// Where each position takes its content from when the whole cube is rotated
// once: x follows R (F moves up), y follows U (R moves to F), z follows F (U moves right).
const SOURCE: Record<'x' | 'y' | 'z', Partial<Record<Face, Face>>> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U' },
  y: { F: 'R', R: 'B', B: 'L', L: 'F' },
  z: { U: 'L', L: 'D', D: 'R', R: 'U' },
};

export function rotateFrame(frame: Frame, axis: 'x' | 'y' | 'z', times: number): Frame {
  let cur: Record<Face, Face> = { ...frame };
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) {
    const next = { ...cur };
    for (const [pos, from] of Object.entries(SOURCE[axis]) as [Face, Face][]) next[pos] = cur[from];
    cur = next;
  }
  return cur;
}

/** The user-frame face currently showing cube face `face`. */
export function userFace(frame: Frame, face: Face): Face {
  return (Object.keys(frame) as Face[]).find((pos) => frame[pos] === face)!;
}

const SUFFIX: Record<Amount, string> = { 1: '', 2: '2', 3: "'" };

/** A cube-frame turn written in the user's notation for this frame, e.g. "R'". */
export function userNotation(frame: Frame, face: Face, amount: Amount): string {
  return `${userFace(frame, face)}${SUFFIX[amount]}`;
}
