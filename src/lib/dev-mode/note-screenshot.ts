import { domToForeignObjectSvg } from 'modern-screenshot';
import { DEV_LAYER_ATTRIBUTE, holderOf, type Rect, type ShotInfo } from '@/lib/dev-mode/note-target';

// A small JPEG of an area of the window, for a developer note. The page is
// drawn from its DOM, not from the screen, so nothing asks for permission and
// developer mode's own layer is left out: modern-screenshot copies the
// smallest element holding the area into an SVG, and only the area of that
// SVG is drawn.
//
// iPhones drew these as one colour (the background) at first. Two things
// there are kept away from: a large copy drawn whole and then cut (the copy
// is now of an element at most 1.5 windows tall, never past a fixed or
// sticky one such as the header, without custom properties, and only the
// area of it is drawn, at most 1200 px a side), and Safari drawing such an
// SVG before it has laid it out (a draw that comes out one colour is drawn
// again after a pause).
// A copy that stays one colour is left out, and the note is saved without
// a screenshot. How it went is kept in the note (`target.shot`).
//
// cubing.js's players draw inside closed shadow roots, which the DOM copy
// cannot see; they are drawn separately and put in their places: a 2D view
// from its SVG (cubing.js keeps each shadow root on `.shadow`), a 3D one
// through the player's own screenshot, from its current camera.

/** The longest side, in image pixels. */
const MAX_SIDE = 1200;
/** What a screenshot aims to stay under; the table takes up to 400,000 characters. */
const MAX_CHARS = 250_000;
/** The tallest element copied, in windows. */
const MAX_HOLDER = 1.5;
/** Pauses before drawing the copy again when it came out one colour (Safari lays it out late). */
const REDRAW_MS = [0, 120, 300, 700, 1500];
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

/** Drops a canvas's pixels at once (iOS limits the memory all canvases hold). */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function encode(canvas: HTMLCanvasElement): string | null {
  let source = canvas;
  try {
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
      if (source !== canvas) release(source);
      source = smaller;
    }
    return null;
  } finally {
    if (source !== canvas) release(source);
  }
}

/** Whether a canvas is one colour, from a grid of samples. */
function oneColour(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = context.getImageData(0, 0, width, height);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 24));
  const at = (x: number, y: number) => (y * width + x) * 4;
  const first = at(0, 0);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = at(x, y);
      if (Math.abs(data[i] - data[first]) > 3 || Math.abs(data[i + 1] - data[first + 1]) > 3 || Math.abs(data[i + 2] - data[first + 2]) > 3) return false;
    }
  }
  return true;
}

/**
 * The CSS properties copied: the standard ones. Custom properties (Tailwind
 * defines hundreds, and every element inherits them) would be copied onto
 * every element and more than double the copy, though the values that use
 * them are already worked out in the standard ones.
 */
let standard: string[] | null = null;
const standardProperties = () => (standard ??= Array.from(getComputedStyle(document.documentElement)).filter((name) => !name.startsWith('--')));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const svgUrl = (svg: SVGElement) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  new XMLSerializer().serializeToString(svg).replace(/[\u0000-\u0008\v\f\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, ''))}`;

async function draw(area: Rect, mark: Rect | null, info: ShotInfo): Promise<string | null> {
  const wanted = clampToWindow(area);
  if (!wanted) { info.error = 'outside the window'; return null; }
  const holder = holderOf(wanted, window.innerHeight * MAX_HOLDER);
  const box = holder.getBoundingClientRect();
  // What of the area the element holds (all of it, unless it stopped below a tall or pinned one).
  const left = Math.max(wanted.x, box.left);
  const top = Math.max(wanted.y, box.top);
  const region = clampToWindow({ x: left, y: top, width: Math.min(wanted.x + wanted.width, box.right) - left, height: Math.min(wanted.y + wanted.height, box.bottom) - top });
  info.holder = holder.getAttribute('data-ui') ?? holder.tagName.toLowerCase();
  info.holderSize = [Math.round(box.width), Math.round(box.height)];
  if (!region) { info.error = 'outside the element copied'; return null; }
  info.drawn = { x: Math.round(region.x), y: Math.round(region.y), width: Math.round(region.width), height: Math.round(region.height) };
  const scale = Math.min(window.devicePixelRatio || 1, 2, MAX_SIDE / Math.max(region.width, region.height));
  info.scale = Math.round(scale * 100) / 100;
  const background = backgroundOf(holder);
  const overlaps = (rect: DOMRect) => rect.right > region.x && rect.left < region.x + region.width
    && rect.bottom > region.y && rect.top < region.y + region.height;
  const players = Array.from(holder.querySelectorAll<Player>(PLAYER)).filter((player) => overlaps(player.getBoundingClientRect()));
  const [svg, ...playerImages] = await Promise.all([
    domToForeignObjectSvg(holder, {
      backgroundColor: background,
      includeStyleProperties: standardProperties(),
      // Players are drawn on their own (a copy would start a player of its own).
      filter: (node) => !(node instanceof Element && (node.hasAttribute(DEV_LAYER_ATTRIBUTE) || node.localName === PLAYER)),
      timeout: TIMEOUT_MS,
      // A scrolled box (a dialog's content) is copied scrolled as it is.
      features: { restoreScrollPosition: true },
    }),
    ...players.map((player) => drawPlayer(player, scale)),
  ]);
  // The copy keeps the element's size; the SVG shows only the area of it.
  const foreign = svg.querySelector('foreignObject');
  foreign?.setAttribute('x', '0');
  foreign?.setAttribute('y', '0');
  foreign?.setAttribute('width', String(box.width));
  foreign?.setAttribute('height', String(box.height));
  svg.setAttribute('viewBox', `${region.x - box.left} ${region.y - box.top} ${region.width} ${region.height}`);
  svg.setAttribute('width', String(region.width));
  svg.setAttribute('height', String(region.height));
  const url = svgUrl(svg);
  info.svgChars = url.length;
  const image = await loadImage(url);

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(region.width * scale));
  out.height = Math.max(1, Math.round(region.height * scale));
  try {
    const context = out.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('no canvas');
    let drawn = false;
    for (const pause of REDRAW_MS) {
      await wait(pause);
      info.attempts = (info.attempts ?? 0) + 1;
      context.fillStyle = background;
      context.fillRect(0, 0, out.width, out.height);
      context.drawImage(image, 0, 0, out.width, out.height);
      if (!oneColour(context, out.width, out.height)) { drawn = true; break; }
    }
    if (!drawn) {
      info.result = 'blank';
      return null;
    }
    for (const player of playerImages) {
      if (!player) continue;
      const { image: drawing, rect } = player;
      context.drawImage(drawing, (rect.left - region.x) * scale, (rect.top - region.y) * scale, rect.width * scale, rect.height * scale);
    }
    if (mark) {
      context.strokeStyle = MARK;
      context.lineWidth = Math.max(2, 2 * scale);
      context.strokeRect((mark.x - region.x) * scale, (mark.y - region.y) * scale, mark.width * scale, mark.height * scale);
    }
    const result = encode(out);
    info.result = result ? 'ok' : 'failed';
    return result;
  } finally {
    release(out);
  }
}

/**
 * The area as a JPEG data URL, with `mark` (a part picked) outlined in it,
 * or null when it cannot be drawn in time or comes out one colour; `info`
 * says how it went.
 */
export async function captureArea(area: Rect, mark: Rect | null = null): Promise<{ screenshot: string | null; info: ShotInfo }> {
  const info: ShotInfo = { result: 'failed' };
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => { timer = setTimeout(() => { info.result = 'timeout'; resolve(null); }, TIMEOUT_MS + 4000); });
  try {
    const screenshot = await Promise.race([draw(area, mark, info), late]);
    return { screenshot, info };
  } catch (error) {
    console.warn('Developer note: the screenshot could not be drawn', error);
    info.result = 'failed';
    info.error = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : String(error).slice(0, 200);
    return { screenshot: null, info };
  } finally {
    clearTimeout(timer);
    info.ms = Math.round(performance.now() - started);
  }
}

/** A part's surroundings: its box and a margin, so the screenshot shows where it is. */
export function aroundPart(rect: Rect, margin = 16): Rect {
  return { x: rect.x - margin, y: rect.y - margin, width: rect.width + margin * 2, height: rect.height + margin * 2 };
}
