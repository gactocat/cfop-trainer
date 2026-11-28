// What a developer note points at, read from the page: a part of the screen
// (the element picked, widened to the control or drawing it belongs to) or
// an area dragged out. Parts are named by their `data-ui` mark, which is the
// component's name in the source (`data-ui="SettingRow"`), so a mark can be
// searched for; the marks around a part say where it is.

export interface Rect { x: number; y: number; width: number; height: number }

export interface NotePart {
  /** Its own mark, if it has one. */
  ui: string | null;
  tag: string;
  id: string | null;
  role: string | null;
  /** aria-label, title or alt. */
  label: string | null;
  /** The start of its text, spaces collapsed. */
  text: string;
  /** The start of its classes. */
  className: string;
  /** From the nearest marked part down to it, e.g. `[data-ui="SettingRow"] > div:nth-of-type(1) > span`. */
  selector: string;
  rect: Rect;
}

export interface NoteTarget {
  kind: 'element' | 'area';
  /** Where it is in the window, in CSS pixels. */
  rect: Rect;
  /** How far the page was scrolled. */
  scroll: { x: number; y: number };
  /** The part picked, or the smallest part holding the whole area. */
  part: NotePart;
  /** The marks around it, nearest first, with the element's id when it has one (`HomeSection#settings`). */
  path: string[];
  /** An area's marked parts inside it, in page order (with the element's id, as in `path`). */
  inside?: { ui: string; text: string }[];
}

/** Marks what developer mode draws, so it is never picked or drawn into a screenshot. */
export const DEV_LAYER_ATTRIBUTE = 'data-dev-layer';
const TEXT_MAX = 160;
const PATH_MAX = 8;
const INSIDE_MAX = 16;

const isLayer = (element: Element) => !!element.closest(`[${DEV_LAYER_ATTRIBUTE}]`);
const collapse = (text: string, max = TEXT_MAX) => {
  const value = text.replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};
/** Its text as shown (blocks apart), else its text content (a drawing's). */
const textOf = (element: Element) => (element instanceof HTMLElement ? element.innerText : element.textContent) ?? '';
const markOf = (element: Element) => {
  const ui = element.getAttribute('data-ui');
  return ui && element.id ? `${ui}#${element.id}` : ui;
};
const rectOf = (element: Element): Rect => {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
};

/** Controls and drawings are picked whole, not the text or shape inside them. */
const WHOLE = 'button, a, label, input, select, textarea, summary, [role="button"], [role="radio"], [role="switch"], [role="tab"], [role="checkbox"], [role="menuitem"]';

/** The part under a point, or null over developer mode's own layer. */
export function partAt(x: number, y: number): Element | null {
  const element = document.elementsFromPoint(x, y).find((candidate) => !isLayer(candidate));
  if (!element || element === document.documentElement) return null;
  return widen(element);
}

function widen(element: Element): Element {
  let part = element;
  // A drawing's shape stands for the whole drawing.
  for (let svg = part.closest('svg'); svg; svg = svg.parentElement?.closest('svg') ?? null) part = svg;
  return part.closest(WHOLE) ?? part;
}

function selectorOf(element: Element): string {
  const steps: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && steps.length < 6) {
    const ui = node.getAttribute('data-ui');
    if (ui) { steps.unshift(`[data-ui="${ui}"]`); break; }
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    const same = parent ? Array.from(parent.children).filter((child) => child.tagName === node!.tagName) : [];
    steps.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
    node = parent;
  }
  return steps.join(' > ');
}

function describe(element: Element): NotePart {
  const label = element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.getAttribute('alt');
  const className = typeof element.className === 'string' ? element.className : element.getAttribute('class') ?? '';
  return {
    ui: element.getAttribute('data-ui'),
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    role: element.getAttribute('role'),
    label: label ? collapse(label) : null,
    text: collapse(textOf(element)),
    className: collapse(className, 300),
    selector: selectorOf(element),
    rect: rectOf(element),
  };
}

function pathOf(element: Element): string[] {
  const path: string[] = [];
  for (let node: Element | null = element.parentElement; node && path.length < PATH_MAX; node = node.parentElement) {
    const mark = markOf(node);
    if (mark) path.push(mark);
  }
  return path;
}

/** What a note's part is called: its mark, else its tag and the nearest mark around it. */
export function partName(target: Pick<NoteTarget, 'part' | 'path'>): string {
  const { part, path } = target;
  if (part?.ui) return part.ui;
  const tag = part?.tag ?? '';
  return path?.[0] ? `${tag} · ${path[0]}` : tag;
}

const scroll = () => ({ x: Math.round(window.scrollX), y: Math.round(window.scrollY) });

export function elementTarget(element: Element): NoteTarget {
  const part = describe(element);
  return { kind: 'element', rect: part.rect, scroll: scroll(), part, path: pathOf(element) };
}

const contains = (outer: DOMRect, inner: Rect) => outer.left <= inner.x + 1 && outer.top <= inner.y + 1
  && outer.right >= inner.x + inner.width - 1 && outer.bottom >= inner.y + inner.height - 1;

/** The smallest element (not the page's own) holding the whole of `rect`. */
export function holderOf(rect: Rect): Element {
  let node = document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2).find((candidate) => !isLayer(candidate)) ?? null;
  while (node && node !== document.body && !contains(node.getBoundingClientRect(), rect)) node = node.parentElement;
  return node ?? document.body;
}

export function areaTarget(rect: Rect): NoteTarget {
  const holder = holderOf(rect);
  const inside: { ui: string; text: string }[] = [];
  for (const element of holder.querySelectorAll('[data-ui]')) {
    if (inside.length >= INSIDE_MAX) break;
    const box = element.getBoundingClientRect();
    const overlaps = box.width > 0 && box.height > 0 && box.right > rect.x && box.left < rect.x + rect.width
      && box.bottom > rect.y && box.top < rect.y + rect.height;
    if (overlaps && !isLayer(element)) inside.push({ ui: markOf(element)!, text: collapse(textOf(element), 80) });
  }
  const rounded = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  return { kind: 'area', rect: rounded, scroll: scroll(), part: describe(holder), path: pathOf(holder), inside };
}
