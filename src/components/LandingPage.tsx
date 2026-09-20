'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useT } from '@/hooks/useT';
import { F2L_IDS } from '@/types/f2l';
import { OLL_IDS } from '@/types/oll';
import { PLL_IDS } from '@/types/pll';

const PRACTICES = [
  { id: 'f2l', name: 'F2L', count: F2L_IDS.length },
  { id: 'oll', name: 'OLL', count: OLL_IDS.length },
  { id: 'pll', name: 'PLL', count: PLL_IDS.length },
] as const;

function Arrow({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-5 ${className}`}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

// Equal tiles on three isometric planes echo the app icon without a WebGL player.
function Cube({ stage }: { stage: 'f2l' | 'oll' | 'pll' }) {
  const faces = [
    { transform: 'matrix(.866 .5 -.866 .5 160 24)', color: 'fill-yellow-300 dark:fill-yellow-300', face: 'top' },
    { transform: 'matrix(.866 .5 0 1 49.15 88)', color: 'fill-blue-500 dark:fill-blue-500', face: 'front' },
    { transform: 'matrix(.866 -.5 0 1 160 152)', color: 'fill-red-500 dark:fill-red-500', face: 'right' },
  ];
  return (
    <svg viewBox="0 0 320 300" fill="none" aria-hidden="true" className="h-full w-full">
      {faces.map(({ transform, color, face }) => (
        <g key={face} transform={transform}>
          {Array.from({ length: 9 }, (_, i) => {
            const highlighted = stage === 'pll' || (stage === 'oll' ? face === 'top' : face !== 'top' && i >= 3);
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
          <Image src="/icon.svg" alt="" width={96} height={96} preload className="size-16 shrink-0 sm:size-24" />
          <span className="whitespace-nowrap text-[clamp(1.75rem,5vw,3rem)] leading-none tracking-tight">
            <span className="font-semibold">{t('landing.brandName')}</span>{' '}<span className="font-light">{t('landing.brandDescriptor')}</span>
          </span>
        </h1>
      </div>

      <nav id="practice" aria-label={t('common.practice')}>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {PRACTICES.map(({ id, name, count }) => (
            <Link key={id} href={`/${id}`} className="group relative flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 sm:block sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500">
              <div className="h-20 w-20 shrink-0 sm:mb-5 sm:h-24 sm:w-24"><Cube stage={id} /></div>
              <div className="min-w-0 flex-1"><div className="flex items-baseline gap-3"><h2 className="text-2xl font-semibold tracking-tight">{name}</h2><span className="text-xs text-zinc-500 dark:text-zinc-400">{t('landing.caseCount', { count })}</span></div><p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{t(`landing.${id}.description`)}</p></div>
              <Arrow className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-700 motion-reduce:transform-none sm:absolute sm:right-6 sm:top-6 dark:text-zinc-500 dark:group-hover:text-emerald-400" />
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
