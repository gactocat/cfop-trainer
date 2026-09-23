// Recolours cubing.js's 3x3x3 stickers to the softer palette of the app icon.
//
// cubing.js has no colour-scheme option, so this reaches into two internals:
// the 2D SVG sources on the shared `cube3x3x3` puzzle loader, and the three.js
// sticker materials of the 3D cube, which cubing.js shares across players.
// Recheck both after upgrading cubing.js; if either changes, players fall back
// to the default colours.

import type { TwistyPlayer } from 'cubing/twisty';

const YELLOW = '#f5d83b';
const BLUE = '#4779e8';
const RED = '#ee6262';
const ORANGE = '#f2a544';
const GREEN = '#43bd89';

// Sticker fills in cubing.js's 3x3x3 SVGs (white is left as is).
const SVG_FILLS: Record<string, string> = {
  yellow: YELLOW,
  '#26f': BLUE,
  red: RED,
  orange: ORANGE,
  limegreen: GREEN,
};

// Sticker colours hard-coded in cubing.js's 3D cube.
const MATERIAL_COLORS: [number, string][] = [
  [0xffff00, YELLOW],
  [0x2266ff, BLUE],
  [0xff0000, RED],
  [0xff9900, ORANGE],
  [0x00ff00, GREEN],
];

type Twisty = typeof import('cubing/twisty');

let loading: Promise<Twisty> | null = null;

// Loads cubing/twisty once, with the 2D sources recoloured before any player
// asks for them.
export function loadRecolouredTwisty(): Promise<Twisty> {
  loading ??= Promise.all([import('cubing/twisty'), import('cubing/puzzles')]).then(
    ([twisty, { cube3x3x3 }]) => {
      const recolour = (load: () => Promise<string>) => {
        let svg: Promise<string> | null = null;
        return () => (svg ??= load().then((source) =>
          source.replace(/fill: (yellow|#26f|red|orange|limegreen)(?=")/g, (_, fill: string) => `fill: ${SVG_FILLS[fill]}`)));
      };
      cube3x3x3.svg = recolour(cube3x3x3.svg);
      if (cube3x3x3.llSVG) cube3x3x3.llSVG = recolour(cube3x3x3.llSVG);
      return twisty;
    },
  );
  return loading;
}

interface ColorLike {
  clone(): ColorLike;
  setHex(hex: number): ColorLike;
  set(color: string): ColorLike;
  convertLinearToSRGB(): ColorLike;
  equals(color: ColorLike): boolean;
}

interface NodeLike {
  material?: { color?: ColorLike } | { color?: ColorLike }[];
  traverse(callback: (node: NodeLike) => void): void;
}

// Recolours the shared 3D sticker materials. Only the first call changes them,
// but every player may have drawn a frame with the old colours, so each one
// is asked to redraw.
export async function recolour3DPlayer(player: TwistyPlayer): Promise<void> {
  const root = (await player.experimentalCurrentThreeJSPuzzleObject()) as unknown as NodeLike;
  root.traverse((node) => {
    for (const material of [node.material ?? []].flat()) {
      const color = material.color;
      if (!color) continue;
      // cubing.js builds each colour as `new Color(hex).convertLinearToSRGB()`.
      const match = MATERIAL_COLORS.find(([from]) => color.equals(color.clone().setHex(from).convertLinearToSRGB()));
      if (!match) continue;
      color.set(match[1]).convertLinearToSRGB();
    }
  });
  player.timestamp = 'start';
}
