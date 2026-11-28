import { domToCanvas } from 'modern-screenshot';
import { DEV_LAYER_ATTRIBUTE, holderOf, type Rect } from '@/lib/dev-mode/note-target';

// A small JPEG of an area of the window, for a developer note. The page is
// drawn from its DOM (modern-screenshot), not from the screen, so nothing
// asks for permission and developer mode's own layer is left out. The
// smallest element holding the area is drawn and cut down to the area.
//
// cubing.js's players draw inside closed shadow roots, which the DOM copy
// cannot see; they are drawn separately and put in their places: a 2D view
// from its SVG (cubing.js keeps each shadow root on `.shadow`), a 3D one
// through the player's own screenshot, from its current camera.

/** The longest side, in image pixels. */
const MAX_SIDE = 1200;
/** What a screenshot aims to stay under; the table takes up to 400,000 characters. */
const MAX_CHARS = 250_000;
/** Pixels drawn before cutting (iOS refuses canvases much larger). */
const MAX_DRAWN = 12_000_000;
const TIMEOUT_MS = 10_000;
const MARK = '#0ea5e9';

const transparent = (colour: string) => colour === 'transparent' || /^rgba\(.*,\s*0\)$/.test(colour);

/** The colour behind an element: its own, or the nearest one around it. */
function backgroundOf(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const colour = getComputedStyle(node).backgroundColor;
    if (!transparent(colour)) return colour;
  }
  return document.documentElement.dataset.theme === 'dark' ? '#09090b' : '#fafafa';
}

type Shadowed = Element & { shadow?: unknown };
type Player = Element & { experimentalScreenshot?: (size: { width: number; height: number }) => Promise<string> };
const PLAYER = 'twisty-player';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image'));
    image.src = src;
  });
}

/** The first drawn SVG in a player's shadow roots (its 2D view). */
function svgIn(root: ParentNode): SVGSVGElement | null {
  for (const element of root.querySelectorAll('*')) {
    if (element instanceof SVGSVGElement && element.getBoundingClientRect().width > 0) return element;
    const shadow = (element as Shadowed).shadow;
    const found = shadow instanceof ShadowRoot ? svgIn(shadow) : null;
    if (found) return found;
  }
  return null;
}

/** A player as an image, with where it goes; null when it cannot be drawn. */
async function drawPlayer(player: Player, scale: number): Promise<{ image: HTMLImageElement; rect: DOMRect } | null> {
  try {
    const shadow = (player as Shadowed).shadow;
    const svg = shadow instanceof ShadowRoot ? svgIn(shadow) : null;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const copy = svg.cloneNode(true) as SVGSVGElement;
      copy.setAttribute('width', String(rect.width));
      copy.setAttribute('height', String(rect.height));
      const source = new XMLSerializer().serializeToString(copy);
      return { image: await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`), rect };
    }
    const rect = player.getBoundingClientRect();
    if (typeof player.experimentalScreenshot !== 'function' || rect.width < 1 || rect.height < 1) return null;
    const url = await player.experimentalScreenshot({ width: Math.round(rect.width * scale), height: Math.round(rect.height * scale) });
    return { image: await loadImage(url), rect };
  } catch {
    return null;
  }
}

function clampToWindow(area: Rect): Rect | null {
  const x = Math.max(0, area.x);
  const y = Math.max(0, area.y);
  const width = Math.min(window.innerWidth, area.x + area.width) - x;
  const height = Math.min(window.innerHeight, area.y + area.height) - y;
  return width >= 2 && height >= 2 ? { x, y, width, height } : null;
}

function encode(canvas: HTMLCanvasElement): string | null {
  let source = canvas;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const quality of [0.8, 0.65, 0.5]) {
      const url = source.toDataURL('image/jpeg', quality);
      if (!url.startsWith('data:image/jpeg')) return null;
      if (url.length <= MAX_CHARS) return url;
    }
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(source.width * 0.7));
    smaller.height = Math.max(1, Math.round(source.height * 0.7));
    smaller.getContext('2d')?.drawImage(source, 0, 0, smaller.width, smaller.height);
    source = smaller;
  }
  return null;
}

async function draw(area: Rect, mark: Rect | null): Promise<string | null> {
  const region = clampToWindow(area);
  if (!region) return null;
  const holder = holderOf(region);
  const box = holder.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2, MAX_SIDE / Math.max(region.width, region.height),
    Math.sqrt(MAX_DRAWN / Math.max(1, box.width * box.height)));
  const overlaps = (rect: DOMRect) => rect.right > region.x && rect.left < region.x + region.width
    && rect.bottom > region.y && rect.top < region.y + region.height;
  const players = Array.from(holder.querySelectorAll<Player>(PLAYER)).filter((player) => overlaps(player.getBoundingClientRect()));
  const [drawn, ...playerImages] = await Promise.all([
    domToCanvas(holder, {
      scale,
      backgroundColor: backgroundOf(holder),
      // Players are drawn on their own (a copy would start a player of its own).
      filter: (node) => !(node instanceof Element && (node.hasAttribute(DEV_LAYER_ATTRIBUTE) || node.localName === PLAYER)),
      timeout: TIMEOUT_MS,
    }),
    ...players.map((player) => drawPlayer(player, scale)),
  ]);
  const ratio = drawn.width / Math.max(1, box.width);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(region.width * ratio));
  out.height = Math.max(1, Math.round(region.height * ratio));
  const context = out.getContext('2d');
  if (!context) return null;
  context.drawImage(drawn, (region.x - box.left) * ratio, (region.y - box.top) * ratio, region.width * ratio, region.height * ratio,
    0, 0, out.width, out.height);
  for (const player of playerImages) {
    if (!player) continue;
    const { image, rect } = player;
    context.drawImage(image, (rect.left - region.x) * ratio, (rect.top - region.y) * ratio, rect.width * ratio, rect.height * ratio);
  }
  if (mark) {
    context.strokeStyle = MARK;
    context.lineWidth = Math.max(2, 2 * ratio);
    context.strokeRect((mark.x - region.x) * ratio, (mark.y - region.y) * ratio, mark.width * ratio, mark.height * ratio);
  }
  return encode(out);
}

/**
 * The area as a JPEG data URL, with `mark` (a part picked) outlined in it;
 * null when it cannot be drawn in time.
 */
export async function captureArea(area: Rect, mark: Rect | null = null): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), TIMEOUT_MS + 2000); });
  try {
    return await Promise.race([draw(area, mark), late]);
  } catch (error) {
    console.warn('Developer note: the screenshot could not be drawn', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A part's surroundings: its box and a margin, so the screenshot shows where it is. */
export function aroundPart(rect: Rect, margin = 16): Rect {
  return { x: rect.x - margin, y: rect.y - margin, width: rect.width + margin * 2, height: rect.height + margin * 2 };
}
