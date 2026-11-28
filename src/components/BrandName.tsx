import type { ReactNode } from 'react';
import { STICKER_COLOURS } from '@/lib/cube-colors';

// The app's name as drawn beside its icon: CFOP in the app's font (Geist),
// its O the cube's green sticker, and TRAINER below or beside it in wide
// capitals. TRAINER is the outlines of Mona Sans (width 125, weight 600)
// rather than the font, which would be a 98 KB download for seven letters;
// see THIRD_PARTY_NOTICES.md. Screen readers hear "CFOP Trainer".

/** Mona Sans units: 1000 to the em, capitals 729 high. */
const EM = 1000;
const CAP = 729;

/**
 * "TRAINER" shaped by HarfBuzz (kerning included) at width 125 and weight
 * 600: each glyph's pen position and advance, its ink's left and right
 * edges, and its outline with the baseline at y = CAP.
 */
const GLYPHS: readonly { x: number; advance: number; left: number; right: number; d: string }[] = [
  { x: 0, advance: 672, left: 9, right: 662, d: 'M261 729V105.4H407.6V729ZM9.1 118.9V0H662.4V118.9Z' },
  { x: 672, advance: 789, left: 58, right: 745, d: 'M57.7 729V0H497.9Q548.3 0 587.9 8.9Q627.6 17.7 657.1 35.1Q686.7 52.6 706.1 77Q725.6 101.4 735.1 132.2Q744.6 163.1 744.6 200.1Q744.6 270.1 709.2 316.7Q673.9 363.4 611.9 381.1V387.6Q650.9 393.6 676.3 411.1Q701.8 428.7 714.4 457.2Q727 485.7 727 526.6V654.3Q727 674.1 728.5 691.6Q730 709 736.1 729H586.8Q581.6 712.6 580.5 694.3Q579.4 676 579.4 654.3V549.6Q579.4 513.3 568.8 490.4Q558.3 467.6 532.3 456.9Q506.3 446.1 459.3 446.1H191.9V338.6H452.1Q532.1 338.6 563.7 306.3Q595.3 274 595.3 222.1Q595.3 192.6 585.1 171.6Q575 150.7 556 137.8Q537 124.9 510.7 119Q484.4 113.1 452.1 113.1H204.9V729Z' },
  { x: 1461, advance: 842, left: 3, right: 838, d: 'M2.9 729 324.9 0H515.7L838.4 729H678.6L461.7 204.6L422.9 108.3H417.6L378.4 206.3L161.6 729ZM215.6 572.4 258.1 461.7H582.9L624 572.4Z' },
  { x: 2303, advance: 263, left: 58, right: 205, d: 'M57.7 729V0H204.9V729Z' },
  { x: 2566, advance: 848, left: 58, right: 791, d: 'M57.7 729V0H237.7L643 539.7H649.9L644.7 311.1V0H790.7V729H613L208.4 192.7H200.7L206 413V729Z' },
  { x: 3414, advance: 689, left: 58, right: 667, d: 'M57.7 729V0H664.9V117.7H168.4L204.9 81.3V647.3L168.4 610.9H666.6V729ZM172.7 414.4V304.4H615.7V414.4Z' },
  { x: 4103, advance: 776, left: 58, right: 745, d: 'M57.7 729V0H497.9Q548.3 0 587.9 8.9Q627.6 17.7 657.1 35.1Q686.7 52.6 706.1 77Q725.6 101.4 735.1 132.2Q744.6 163.1 744.6 200.1Q744.6 270.1 709.2 316.7Q673.9 363.4 611.9 381.1V387.6Q650.9 393.6 676.3 411.1Q701.8 428.7 714.4 457.2Q727 485.7 727 526.6V654.3Q727 674.1 728.5 691.6Q730 709 736.1 729H586.8Q581.6 712.6 580.5 694.3Q579.4 676 579.4 654.3V549.6Q579.4 513.3 568.8 490.4Q558.3 467.6 532.3 456.9Q506.3 446.1 459.3 446.1H191.9V338.6H452.1Q532.1 338.6 563.7 306.3Q595.3 274 595.3 222.1Q595.3 192.6 585.1 171.6Q575 150.7 556 137.8Q537 124.9 510.7 119Q484.4 113.1 452.1 113.1H204.9V729Z' },
];

/**
 * TRAINER as an image, its ink from the first capital's left to the last
 * one's right, the capitals' top to the baseline. `tracking` (in em) spaces
 * the letters out; the width follows the CSS size given (className).
 */
export function TrainerMark({ tracking, className }: { tracking: number; className: string }) {
  const space = tracking * EM;
  const at = (i: number) => GLYPHS[i].x + i * space;
  const left = at(0) + GLYPHS[0].left;
  const right = at(GLYPHS.length - 1) + GLYPHS[GLYPHS.length - 1].right;
  return (
    <svg viewBox={`${left} 0 ${right - left} ${CAP}`} aria-hidden="true" fill="currentColor" className={className}>
      {GLYPHS.map((glyph, i) => <path key={i} transform={`translate(${at(i)} 0)`} d={glyph.d} />)}
    </svg>
  );
}

/** CFOP with the cube's green O. */
export function CfopWord(): ReactNode {
  return <>CF<span style={{ color: STICKER_COLOURS.green }}>O</span>P</>;
}

/** The capitals' top to the baseline as the line box, so two lines meet the icon's top and bottom edges. */
const TRIM = '[text-box:trim-both_cap_alphabetic]';

/**
 * The app's name: CFOP over TRAINER, as tall as the icon beside it (`--h`),
 * large on the top page and small in every page's header: CFOP's capitals
 * start at the icon's top, TRAINER (as wide as CFOP) ends on its bottom.
 */
export function BrandStack({ label }: { label: string }) {
  return (
    <span className="flex h-[var(--h)] flex-col justify-between">
      <span className="sr-only">{label}</span>
      <span aria-hidden className={`${TRIM} block text-[calc(var(--h)*0.82)] leading-none font-extrabold tracking-[-0.02em]`}><CfopWord /></span>
      {/* As wide as CFOP: it adds nothing to the column's width, then fills it. */}
      <TrainerMark tracking={0.29} className="block h-auto w-0 min-w-full text-zinc-500 dark:text-zinc-400" />
    </span>
  );
}
