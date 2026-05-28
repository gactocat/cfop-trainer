// Custom stickering mask for the F2L 3D player.
//
// cubing.js ships an "F2L" stickering, but it greys out the puzzle's U-layer
// pieces (= the white-side pieces in cubing.js's default 3x3x3 color scheme).
// F2L3DPlayer prepends `z2` to setup-alg so the cube is shown in CFOP
// orientation (yellow on top, white on bottom). Because z2 flips the cube,
// the puzzle's U-layer ends up at the visual bottom — i.e. cubing.js's
// built-in F2L stickering greys the wrong side.
//
// This mask instead ignores the puzzle's D-layer pieces (yellow side), which
// after the z2 rotation are the ones the viewer perceives as the LL.
// Everything else stays "regular" so F2L slots, the middle layer and the
// new D face (originally U / white) keep their full colors.
//
// Piece order matches the 3x3x3 KPuzzle definition shipped by cubing.js v0.63:
//   CORNERS: 0–3 = U-layer (white side), 4–7 = D-layer (yellow side)
//   EDGES:   0–3 = U-layer, 4–7 = D-layer, 8–11 = middle slots
//   CENTERS: 0=U, 1=L, 2=F, 3=R, 4=B, 5=D

type FaceletMask = 'regular' | 'dim' | 'oriented' | 'ignored' | 'invisible';

interface PieceMask {
  facelets: FaceletMask[];
}

interface OrbitMask {
  pieces: (PieceMask | null)[];
}

interface StickeringMask {
  orbits: Record<string, OrbitMask>;
}

const REG_CORNER: PieceMask = { facelets: ['regular', 'regular', 'regular'] };
const IGN_CORNER: PieceMask = { facelets: ['ignored', 'ignored', 'ignored'] };
const REG_EDGE: PieceMask = { facelets: ['regular', 'regular'] };
const IGN_EDGE: PieceMask = { facelets: ['ignored', 'ignored'] };
const REG_CENTER: PieceMask = {
  facelets: ['regular', 'regular', 'regular', 'regular'],
};
const IGN_CENTER: PieceMask = {
  facelets: ['ignored', 'ignored', 'ignored', 'ignored'],
};

export const F2L_STICKERING_MASK: StickeringMask = {
  orbits: {
    CORNERS: {
      pieces: [
        REG_CORNER, REG_CORNER, REG_CORNER, REG_CORNER,
        IGN_CORNER, IGN_CORNER, IGN_CORNER, IGN_CORNER,
      ],
    },
    EDGES: {
      pieces: [
        REG_EDGE, REG_EDGE, REG_EDGE, REG_EDGE,
        IGN_EDGE, IGN_EDGE, IGN_EDGE, IGN_EDGE,
        REG_EDGE, REG_EDGE, REG_EDGE, REG_EDGE,
      ],
    },
    CENTERS: {
      pieces: [
        REG_CENTER,
        REG_CENTER,
        REG_CENTER,
        REG_CENTER,
        REG_CENTER,
        IGN_CENTER,
      ],
    },
  },
};
