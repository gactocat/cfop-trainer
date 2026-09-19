// Both OLL views start with x2 (yellow U, blue F, red R). Stickering follows
// physical pieces, so highlight D-layer yellow facelets, not the default
// white U-layer. Side colours carry no information for OLL recognition.
type Facelet = 'regular' | 'ignored';
interface PieceMask { facelets: Facelet[] }
const ignored = (count: number): PieceMask => ({ facelets: Array<Facelet>(count).fill('ignored') });
const yellow = (count: number): PieceMask => ({ facelets: ['regular', ...Array<Facelet>(count - 1).fill('ignored')] });

export const OLL_STICKERING_MASK = {
  orbits: {
    CORNERS: {
      pieces: Array.from({ length: 8 }, (_, i) => i >= 4 ? yellow(3) : ignored(3)),
    },
    EDGES: {
      pieces: Array.from({ length: 12 }, (_, i) => i >= 4 && i < 8 ? yellow(2) : ignored(2)),
    },
    CENTERS: {
      pieces: Array.from({ length: 6 }, (_, i) => i === 5 ? yellow(1) : ignored(1)),
    },
  },
};
