'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HOME_GROUPS, type HomeEntry, type HomeEntryArt, type HomeGroup } from '@/data/home-entries';
import { useT } from '@/hooks/useT';
import { HomeSection, HomeSettings, SECTION_ICON } from './HomeSettings';

// Equal tiles on three isometric planes echo the app icon without a WebGL player.
// Each entry lights up the stickers of its stage, the rest grey; a whole
// solve, the whole cube. The stages split the cube between them: the cross
// (the centres and the bottom edges), F2L (the four pairs: the corners and
// edges of the two lower layers around it) and the last layer.
//
// Stickers are numbered row by row; a side's row 0 touches the top face, so
// on a side 4 is the centre, 7 the bottom edge (the cross, whose white is
// underneath, out of sight) and 3, 5, 6, 8 the pairs.
const lit = (stage: HomeEntryArt, face: string, i: number) => {
  switch (stage) {
    case 'solve': return true;
    case 'cross': return face !== 'top' && (i === 4 || i === 7);
    case 'f2l': return face !== 'top' && [3, 5, 6, 8].includes(i);
    case 'pll': return face === 'top' || i < 3;
    case 'oll': return face === 'top';
  }
};

const FACES = [
  { transform: 'matrix(.866 .5 -.866 .5 160 24)', color: 'fill-[#f5d83b]', face: 'top' },
  { transform: 'matrix(.866 .5 0 1 49.15 88)', color: 'fill-[#4779e8]', face: 'front' },
  { transform: 'matrix(.866 -.5 0 1 160 152)', color: 'fill-[#ee6262]', face: 'right' },
];

function Cube({ stage }: { stage: HomeEntryArt }) {
  return (
    <svg viewBox="0 0 320 300" fill="none" aria-hidden="true" className="h-full w-full">
      {FACES.map(({ transform, color, face }) => (
        <g key={face} transform={transform}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={(i % 3) * 44} y={Math.floor(i / 3) * 44} width="40" height="40" rx="4"
              className={lit(stage, face, i) ? color : 'fill-zinc-200 dark:fill-zinc-700'} />
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
// On the section's panel the tile's own border is faint, so the panel's
// outline is the one that reads.
const PLAIN = 'border-zinc-200/60 bg-white hover:border-emerald-600 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-emerald-500';
const FEATURED = 'col-span-full border-emerald-300 bg-emerald-50/50 hover:border-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:hover:border-emerald-500';

function Entry({ entry }: { entry: HomeEntry }) {
  const { href, name, art, featured } = entry;
  return (
    <Link href={href} className={`${TILE} ${featured ? FEATURED : PLAIN}`}>
      <span className="size-14 sm:size-18"><Cube stage={art} /></span>
      <span className="text-lg font-semibold tracking-tight sm:text-2xl">{name}</span>
    </Link>
  );
}

// A group: its icon and name, then its entries.
function Group({ group }: { group: HomeGroup }) {
  const { t } = useT();
  return (
    <HomeSection id={group.id} title={t(group.title)} icon={SECTION_ICON[group.id]} as="nav">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {group.entries.map((entry) => <Entry key={entry.id} entry={entry} />)}
      </div>
    </HomeSection>
  );
}

// The top page: the app's name, then the algorithms, the solves and the
// settings, each in its section's panel, one spacing between them, narrower
// than the other pages so the tiles stay near square on a wide screen.
export function LandingPage() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-6 sm:space-y-6 sm:pb-10">
      <div className="flex justify-center pt-2 pb-2 sm:pt-6 sm:pb-4">
        <h1 className="flex items-center gap-3 sm:gap-4">
          <Image src="/logo.svg" alt="" width={93} height={98} preload className="h-11 w-auto shrink-0 sm:h-14" />
          <span className="whitespace-nowrap text-[1.75rem] leading-none tracking-tight sm:text-4xl">
            {/* As heavy as the header's name. */}
            <span className="font-semibold">{t('landing.brandName')} {t('landing.brandDescriptor')}</span>
          </span>
        </h1>
      </div>
      {HOME_GROUPS.map((group) => <Group key={group.id} group={group} />)}
      <HomeSettings />
    </div>
  );
}
