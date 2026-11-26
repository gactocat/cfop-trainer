'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HOME_GROUPS, type HomeEntryArt } from '@/data/home-entries';
import { useT } from '@/hooks/useT';
import { HomeSettings } from './HomeSettings';

// Equal tiles on three isometric planes echo the app icon without a WebGL player.
// A stage lights up its stickers; a solve, the whole cube.
function Cube({ stage }: { stage: HomeEntryArt }) {
  const faces = [
    { transform: 'matrix(.866 .5 -.866 .5 160 24)', color: 'fill-[#f5d83b] dark:fill-[#f5d83b]', face: 'top' },
    { transform: 'matrix(.866 .5 0 1 49.15 88)', color: 'fill-[#4779e8] dark:fill-[#4779e8]', face: 'front' },
    { transform: 'matrix(.866 -.5 0 1 160 152)', color: 'fill-[#ee6262] dark:fill-[#ee6262]', face: 'right' },
  ];
  return (
    <svg viewBox="0 0 320 300" fill="none" aria-hidden="true" className="h-full w-full">
      {faces.map(({ transform, color, face }) => (
        <g key={face} transform={transform}>
          {Array.from({ length: 9 }, (_, i) => {
            // Side rows 1-2 are the first two layers; row 0 belongs to the last layer.
            const highlighted = stage === 'solve' || (stage === 'f2l' ? face !== 'top' && i >= 3 : face === 'top' || (stage === 'pll' && i < 3));
            return <rect key={i} x={(i % 3) * 44} y={Math.floor(i / 3) * 44} width="40" height="40" rx="4" className={highlighted ? color : 'fill-zinc-200 dark:fill-zinc-700'} />;
          })}
        </g>
      ))}
    </svg>
  );
}

export function LandingPage() {
  const { t } = useT();
  return (
    <div className="pb-6 sm:pb-10">
      <div className="flex justify-center pb-10 pt-8 sm:pb-14 sm:pt-16">
        <h1 className="flex items-center gap-4 sm:gap-6">
          <Image src="/logo.svg" alt="" width={93} height={98} preload className="h-16 w-auto shrink-0 sm:h-24" />
          <span className="whitespace-nowrap text-[clamp(1.75rem,5vw,3rem)] leading-none tracking-tight">
            <span className="font-semibold">{t('landing.brandName')}</span>{' '}<span className="font-light">{t('landing.brandDescriptor')}</span>
          </span>
        </h1>
      </div>

      {HOME_GROUPS.map((group, index) => (
        <nav key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className={index > 0 ? 'mt-8 sm:mt-10' : ''}>
          <h2 id={`${group.id}-heading`} className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">{t(group.title)}</h2>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {group.entries.map(({ id, href, name, art }) => (
              <Link key={id} href={href} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 sm:block sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500">
                <div className="h-20 w-20 shrink-0 sm:mb-5 sm:h-24 sm:w-24"><Cube stage={art} /></div>
                <h3 className="min-w-0 text-2xl font-semibold tracking-tight">{name}</h3>
              </Link>
            ))}
          </div>
        </nav>
      ))}

      <HomeSettings />
    </div>
  );
}
