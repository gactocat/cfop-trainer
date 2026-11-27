'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HOME_GROUPS, type HomeEntry, type HomeEntryArt, type HomeGroup } from '@/data/home-entries';
import { useT } from '@/hooks/useT';
import { HomeSettings } from './HomeSettings';

// Equal tiles on three isometric planes echo the app icon without a WebGL player.
// A stage lights up its stickers; a solve, the whole cube.
//
// Stickers are numbered row by row; a side's row 0 touches the top face.
// The cross is drawn on top: its edges and centre, and on each side the
// edge's other sticker and the centre it lines up with.
const lit = (stage: HomeEntryArt, face: string, i: number) => {
  switch (stage) {
    case 'solve': return true;
    case 'cross': return face === 'top' ? [1, 3, 4, 5, 7].includes(i) : i === 1 || i === 4;
    case 'f2l': return face !== 'top' && i >= 3;
    case 'pll': return face === 'top' || i < 3;
    case 'oll': return face === 'top';
  }
};

const FACES = [
  { transform: 'matrix(.866 .5 -.866 .5 160 24)', color: 'fill-[#f5d83b]', face: 'top' },
  { transform: 'matrix(.866 .5 0 1 49.15 88)', color: 'fill-[#4779e8]', face: 'front' },
  { transform: 'matrix(.866 -.5 0 1 160 152)', color: 'fill-[#ee6262]', face: 'right' },
];
// A solve starts from a scramble: what it does not solve is drawn in mixed,
// faded colours (the same every time), where an algorithm's stage leaves the
// rest grey.
const MIXED = ['fill-[#f5d83b]/35', 'fill-[#4779e8]/35', 'fill-[#ee6262]/35', 'fill-[#4cc38a]/35', 'fill-[#f59f3a]/35', 'fill-zinc-300/60 dark:fill-zinc-500/40'];
const mixed = (face: number, i: number) => MIXED[(face * 4 + i * 5 + (i % 3) * 2) % MIXED.length];

function Cube({ stage, from }: { stage: HomeEntryArt; from: 'stage' | 'scramble' }) {
  return (
    <svg viewBox="0 0 320 300" fill="none" aria-hidden="true" className="h-full w-full">
      {FACES.map(({ transform, color, face }, f) => (
        <g key={face} transform={transform}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={(i % 3) * 44} y={Math.floor(i / 3) * 44} width="40" height="40" rx="4"
              className={lit(stage, face, i) ? color : from === 'scramble' ? mixed(f, i) : 'fill-zinc-200 dark:fill-zinc-700'} />
          ))}
        </g>
      ))}
    </svg>
  );
}

// Every entry is a tile of the same grid, three across at every width, the
// same height, its cube above its name, both centred; CFOP, the solve,
// takes the whole row of its group and a tint, so it stands out without
// another size or layout. Only the cube and the name: no counts, text or arrows.
const TILE = 'flex h-32 flex-col items-center justify-center gap-2 rounded-xl border px-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:h-40 sm:gap-3';
const PLAIN = 'border-zinc-200 bg-white hover:border-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500';
const FEATURED = 'col-span-full border-emerald-300 bg-emerald-50/50 hover:border-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:border-emerald-500';

function Entry({ entry, from }: { entry: HomeEntry; from: 'stage' | 'scramble' }) {
  const { href, name, art, featured } = entry;
  return (
    <Link href={href} className={`${TILE} ${featured ? FEATURED : PLAIN}`}>
      <span className="size-14 sm:size-18"><Cube stage={art} from={from} /></span>
      <span className="text-lg font-semibold tracking-tight sm:text-2xl">{name}</span>
    </Link>
  );
}

// A group: its name, then its entries. The algorithms draw a stage on a grey
// cube; the solves, which start from a scramble, the part they solve on a
// cube of faded mixed colours, so their F2L does not look like the
// algorithms' one.
function Group({ group }: { group: HomeGroup }) {
  const { t } = useT();
  return (
    <nav id={group.id} aria-labelledby={`${group.id}-heading`}>
      <h2 id={`${group.id}-heading`} className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">{t(group.title)}</h2>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {group.entries.map((entry) => <Entry key={entry.id} entry={entry} from={group.id === 'solve' ? 'scramble' : 'stage'} />)}
      </div>
    </nav>
  );
}

// The top page: the app's name, the algorithms, the solves and the
// settings, one spacing between them, narrower than the other pages so the
// tiles stay near square on a wide screen.
export function LandingPage() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-6 sm:space-y-10 sm:pb-10">
      <div className="flex justify-center pt-2 sm:pt-6">
        <h1 className="flex items-center gap-3 sm:gap-4">
          <Image src="/logo.svg" alt="" width={93} height={98} preload className="h-11 w-auto shrink-0 sm:h-14" />
          <span className="whitespace-nowrap text-[1.75rem] leading-none tracking-tight sm:text-4xl">
            <span className="font-semibold">{t('landing.brandName')}</span>{' '}<span className="font-light">{t('landing.brandDescriptor')}</span>
          </span>
        </h1>
      </div>
      {HOME_GROUPS.map((group) => <Group key={group.id} group={group} />)}
      <HomeSettings />
    </div>
  );
}
