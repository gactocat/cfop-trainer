// Both OLL views start with x2 (yellow U, blue F, red R). Stickering follows
// physical pieces, so highlight D-layer yellow facelets, not the default
// white U-layer. Side colours carry no information for OLL recognition.
type Facelet = 'regular' | 'ignored';
interface PieceMask { facelets: Facelet[] }
const ignored = (count: number): PieceMask => ({ facelets: Array<Facelet>(count).fill('ignored') });
const topColour = (count: number): PieceMask => ({ facelets: ['regular', ...Array<Facelet>(count - 1).fill('ignored')] });

/**
 * Show only the last layer's top colour, given which layer of cubing.js's
 * puzzle it is: D (yellow) when yellow is on top, U (white) when white is.
 */
export function ollStickeringMask(lastLayer: 'U' | 'D') {
  const inLastLayer = (i: number) => (lastLayer === 'D' ? i >= 4 && i < 8 : i < 4);
  return {
    orbits: {
      CORNERS: { pieces: Array.from({ length: 8 }, (_, i) => (inLastLayer(i) ? topColour(3) : ignored(3))) },
      EDGES: { pieces: Array.from({ length: 12 }, (_, i) => (inLastLayer(i) ? topColour(2) : ignored(2))) },
      CENTERS: { pieces: Array.from({ length: 6 }, (_, i) => (i === (lastLayer === 'D' ? 5 : 0) ? topColour(1) : ignored(1))) },
    },
  };
}

export const OLL_STICKERING_MASK = ollStickeringMask('D');
