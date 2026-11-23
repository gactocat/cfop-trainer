// Recolours cubing.js's 3x3x3 stickers to the softer palette of the app icon.
//
// cubing.js has no colour-scheme option, so this reaches into two internals:
// the 2D SVG sources on the shared `cube3x3x3` puzzle loader, and the three.js
// sticker materials of the 3D cube, which cubing.js shares across players.
// Recheck both after upgrading cubing.js; if either changes, players fall back
// to the default colours.
//
// It also darkens the floating hint of an ignored sticker. cubing.js draws
// ignored stickers dark grey but their hints light grey, which reads as white
// on a dark background and is hard to tell from the white face's hints.

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

// Ignored stickers and their hints in cubing.js's 3D cube.
const IGNORED = 0x666666;
const IGNORED_HINT = 0xcccccc;
const BACK_SIDE = 1; // three.js BackSide: hint stickers face away from the viewer.

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

interface MaterialLike {
  color?: ColorLike;
  side?: number;
  transparent?: boolean;
}

interface NodeLike {
  material?: MaterialLike | MaterialLike[];
  traverse(callback: (node: NodeLike) => void): void;
}

// cubing.js builds each colour as `new Color(hex).convertLinearToSRGB()`.
const isColor = (color: ColorLike, hex: number) => color.equals(color.clone().setHex(hex).convertLinearToSRGB());

let ignoredHintDarkened = false;

// The ignored hint material is shared too, but only reachable from a hint
// sticker that a stickering mask has marked ignored. Returns whether it was
// found (and so is now dark for every player).
function darkenIgnoredHint(root: NodeLike): boolean {
  if (ignoredHintDarkened) return true;
  root.traverse((node) => {
    for (const material of [node.material ?? []].flat()) {
      const color = material.color;
      if (!color || material.side !== BACK_SIDE || !material.transparent || !isColor(color, IGNORED_HINT)) continue;
      color.setHex(IGNORED).convertLinearToSRGB();
      ignoredHintDarkened = true;
    }
  });
  return ignoredHintDarkened;
}

// Recolours the shared 3D sticker materials. Only the first call changes them,
// but every player may have drawn a frame with the old colours, so each one
// is asked to redraw.
export async function recolour3DPlayer(player: TwistyPlayer): Promise<void> {
  let root: NodeLike | null = null;
  // A mask set after the player was created reaches the cube later, so look
  // for the ignored hint again whenever the player schedules a render.
  const onRender = () => {
    if (ignoredHintDarkened || !root || !darkenIgnoredHint(root)) return;
    void player.experimentalCurrentVantages().then((vantages) => {
      for (const vantage of vantages) vantage.scheduleRender();
    });
  };
  root = (await player.experimentalCurrentThreeJSPuzzleObject(onRender)) as unknown as NodeLike;
  root.traverse((node) => {
    for (const material of [node.material ?? []].flat()) {
      const color = material.color;
      if (!color) continue;
      const match = MATERIAL_COLORS.find(([from]) => isColor(color, from));
      if (!match) continue;
      color.set(match[1]).convertLinearToSRGB();
    }
  });
  darkenIgnoredHint(root);
  player.timestamp = 'start';
}
