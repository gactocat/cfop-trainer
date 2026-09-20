'use client';

import Link from 'next/link';
import { useT } from '@/hooks/useT';
import { F2L_IDS } from '@/types/f2l';
import { OLL_IDS } from '@/types/oll';
import { PLL_IDS } from '@/types/pll';
import { ShuffleIcon } from './ShuffleIcon';

const PRACTICES = [
  { id: 'f2l', name: 'F2L', count: F2L_IDS.length },
  { id: 'oll', name: 'OLL', count: OLL_IDS.length },
  { id: 'pll', name: 'PLL', count: PLL_IDS.length },
] as const;

function Arrow({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-5 ${className}`}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

// Equal tiles on three isometric planes echo the app icon without a WebGL player.
function Cube({ stage }: { stage?: 'f2l' | 'oll' | 'pll' }) {
  const faces = [
    { transform: 'matrix(.866 .5 -.866 .5 160 24)', color: 'fill-yellow-300 dark:fill-yellow-300', face: 'top' },
    { transform: 'matrix(.866 .5 0 1 49.15 88)', color: 'fill-emerald-500 dark:fill-emerald-400', face: 'front' },
    { transform: 'matrix(.866 -.5 0 1 160 152)', color: 'fill-orange-400 dark:fill-orange-400', face: 'right' },
  ];
  return (
    <svg viewBox="0 0 320 300" fill="none" aria-hidden="true" className="h-full w-full">
      {faces.map(({ transform, color, face }) => (
        <g key={face} transform={transform}>
          {Array.from({ length: 9 }, (_, i) => {
            const highlighted = !stage || stage === 'pll' || (stage === 'oll' ? face === 'top' : face !== 'top' && i >= 3);
            return <rect key={i} x={(i % 3) * 44} y={Math.floor(i / 3) * 44} width="40" height="40" rx="4" className={highlighted ? color : 'fill-zinc-200 dark:fill-zinc-700'} />;
          })}
        </g>
      ))}
    </svg>
  );
}

function FeatureIcon({ kind }: { kind: 'algorithms' | 'times' | 'random' }) {
  if (kind === 'random') return <ShuffleIcon className="size-5" />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
      {kind === 'algorithms' ? <><path d="M8 4H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M8 11h8m-8 5h5" /></> : <><circle cx="12" cy="14" r="8" /><path d="M12 10v4l3 2M9 2h6m-3 0v4m6 1 2-2" /></>}
    </svg>
  );
}

export function LandingPage() {
  const { t } = useT();
  return (
    <div className="pb-6 sm:pb-10">
      <section className="grid items-center gap-8 pb-12 pt-5 sm:gap-12 sm:pb-16 sm:pt-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-20 lg:pt-12">
        <div>
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />{t('landing.eyebrow')}</p>
          <h1 className="text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.15] font-semibold tracking-tight">
            {t('landing.title')}<br /><span className="text-emerald-700 dark:text-emerald-400">{t('landing.titleAccent')}</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">{t('landing.description')}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href="#practice" className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400">
              {t('landing.start')}<Arrow />
            </a>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('landing.noAccount')}</span>
          </div>
        </div>
        <div className="relative isolate overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100 px-5 pb-5 pt-4 sm:px-7 sm:pb-7 dark:border-zinc-800 dark:bg-zinc-900">
          <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-zinc-300/70 dark:text-zinc-700/60" aria-hidden="true"><defs><pattern id="landing-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" /></pattern></defs><rect width="100%" height="100%" fill="url(#landing-grid)" /></svg>
          <div className="flex items-center justify-between text-[10px] font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400"><span>{t('landing.preview')}</span><span className="font-mono">F2L / OLL / PLL</span></div>
          <div className="mx-auto h-44 w-52 sm:h-60 sm:w-72"><Cube /></div>
          <div className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400"><span>{t('landing.yourAlgorithm')}</span><span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">F2L</span></div>
            <div className="mt-3 flex items-end justify-between gap-3"><code className="whitespace-nowrap text-lg font-medium tracking-tight sm:text-xl">R U R&apos; U&apos;</code><div className="shrink-0 text-right"><span className="font-mono text-2xl font-medium tabular-nums text-emerald-700 dark:text-emerald-400">1.28<span className="ml-1 text-xs">s</span></span><p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{t('landing.sampleTime')}</p></div></div>
          </div>
        </div>
      </section>

      <section id="practice" aria-labelledby="practice-title" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 id="practice-title" className="text-xl font-semibold tracking-tight">{t('landing.practiceTitle')}</h2><p className="text-sm text-zinc-500 dark:text-zinc-400">{t('landing.practiceSubtitle')}</p></div>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {PRACTICES.map(({ id, name, count }) => (
            <Link key={id} href={`/${id}`} className="group relative flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 sm:block sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500">
              <div className="h-20 w-20 shrink-0 sm:mb-5 sm:h-24 sm:w-24"><Cube stage={id} /></div>
              <div className="min-w-0 flex-1"><div className="flex items-baseline gap-3"><h3 className="text-2xl font-semibold tracking-tight">{name}</h3><span className="text-xs text-zinc-500 dark:text-zinc-400">{t('landing.caseCount', { count })}</span></div><p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{t(`landing.${id}.description`)}</p></div>
              <Arrow className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-700 motion-reduce:transform-none sm:absolute sm:right-6 sm:top-6 dark:text-zinc-500 dark:group-hover:text-emerald-400" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="workflow-title" className="mt-14 border-t border-zinc-200 pt-10 sm:mt-16 sm:pt-12 dark:border-zinc-800">
        <h2 id="workflow-title" className="text-xl font-semibold tracking-tight">{t('landing.workflowTitle')}</h2>
        <div className="mt-7 grid gap-8 sm:grid-cols-3 sm:gap-8">
          {(['algorithms', 'times', 'random'] as const).map((kind, index) => (
            <div key={kind}>
              <div className="mb-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-400"><FeatureIcon kind={kind} /><span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">0{index + 1}</span></div>
              <h3 className="text-base font-semibold">{t(`landing.${kind}.title`)}</h3>
              <p className="mt-2 max-w-sm text-sm leading-7 text-zinc-600 dark:text-zinc-400">{t(`landing.${kind}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
