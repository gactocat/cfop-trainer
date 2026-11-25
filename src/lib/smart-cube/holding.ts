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

/** A named holding's frame, or a frame as it is. */
export const toFrame = (holding: CubeHolding | Frame): Frame => (typeof holding === 'string' ? HOLDING_FRAMES[holding] : holding);

/**
 * The rotation that shows cubing.js's default cube (white U, green F) in this
 * holding, for a player's setup: yellow-blue matches the app's 3D views.
 */
export function displayRotation(holding: CubeHolding): string {
  return holding === 'yellow-blue' ? 'x2' : holding === 'yellow-green' ? 'z2' : '';
}

/** The cube face that is the last layer (the face on top) when held this way. */
export const lastLayerFace = (holding: CubeHolding): LastLayerFace => HOLDING_FRAMES[holding].U as LastLayerFace;

// --- Holdings by colour: any top colour with any front colour beside it.

export type CubeColour = 'white' | 'yellow' | 'green' | 'blue' | 'red' | 'orange';
export const CUBE_COLOURS: readonly CubeColour[] = ['white', 'yellow', 'green', 'blue', 'red', 'orange'];
/** The colour of each of the cube's own faces (white U, green F). */
export const FACE_COLOUR: Readonly<Record<Face, CubeColour>> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
const COLOUR_FACE = Object.fromEntries(Object.entries(FACE_COLOUR).map(([face, colour]) => [colour, face])) as Record<CubeColour, Face>;
const OPPOSITE_FACE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

export interface ColourHolding {
  top: CubeColour;
  front: CubeColour;
}

export const oppositeColour = (colour: CubeColour): CubeColour => FACE_COLOUR[OPPOSITE_FACE[COLOUR_FACE[colour]]];

/** A front colour can be any colour but the top one and its opposite. */
export const fitsTop = (top: CubeColour, front: CubeColour) => front !== top && front !== oppositeColour(top);

/** The named holding as colours, e.g. yellow-blue is yellow top, blue front. */
export function holdingColours(holding: CubeHolding): ColourHolding {
  const frame = HOLDING_FRAMES[holding];
  return { top: FACE_COLOUR[frame.U], front: FACE_COLOUR[frame.F] };
}

// The 24 ways to hold the cube, each reached from the cube's own frame by
// rotations. Built on first use (rotateFrame's table is defined below).
let allFrames: readonly Frame[] | null = null;
function everyFrame(): readonly Frame[] {
  const identity: Frame = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };
  const tops: ['x' | 'z', number][] = [['x', 0], ['x', 1], ['x', 2], ['x', 3], ['z', 1], ['z', 3]];
  allFrames ??= tops.flatMap(([axis, times]) => [0, 1, 2, 3].map((y) => rotateFrame(rotateFrame(identity, axis, times), 'y', y)));
  return allFrames;
}

/** The frame for a top and front colour; null when they do not fit together. */
export function colourFrame({ top, front }: ColourHolding): Frame | null {
  if (!fitsTop(top, front)) return null;
  return everyFrame().find((frame) => frame.U === COLOUR_FACE[top] && frame.F === COLOUR_FACE[front]) ?? null;
}

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
