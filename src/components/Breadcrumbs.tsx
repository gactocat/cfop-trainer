'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getPllDefinition } from '@/data/pll-definitions';
import { useT } from '@/hooks/useT';
import { F2L_IDS, type F2LId } from '@/types/f2l';
import { OLL_IDS, type OLLId } from '@/types/oll';
import type { PllId } from '@/types/pll';

const STAGES = { f2l: 'F2L', oll: 'OLL', pll: 'PLL' } as const;
type Stage = keyof typeof STAGES;
const isStage = (segment: string | undefined): segment is Stage => !!segment && segment in STAGES;

type Crumb = { label: string; href?: string };
type Translate = ReturnType<typeof useT>['t'];

function caseName(stage: Stage, id: string, t: Translate): string | undefined {
  if (stage === 'pll') return getPllDefinition(id as PllId)?.name;
  // OLL-21 and F2L-17 carry their number.
  const number = id.slice(4);
  if (stage === 'oll') return OLL_IDS.includes(id as OLLId) ? `OLL ${number}` : undefined;
  return F2L_IDS.includes(id as F2LId) ? t('common.f2lCase', { number }) : undefined;
}

// Where the page sits below the top page: the stage, then the case.
function crumbsFor(pathname: string, t: Translate): Crumb[] {
  const [first, id] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (first === 'privacy' || first === 'support') return [{ label: t(`${first}.title`) }];
  if (!isStage(first)) return [];
  const name = id ? caseName(first, id, t) : undefined;
  return name
    ? [{ label: STAGES[first], href: `/${first}` }, { label: name }]
    : [{ label: STAGES[first] }];
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

// The header's left side: CFOP Trainer (the top page, where the settings
// are), then the stage and the case, e.g. CFOP Trainer > PLL > T Perm.
export function Breadcrumbs() {
  const { t } = useT();
  const crumbs = crumbsFor(usePathname() ?? '/', t);
  return (
    <nav aria-label={t('nav.breadcrumb')} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 whitespace-nowrap text-base font-semibold tracking-tight sm:gap-1.5 sm:text-lg">
        <li className="shrink-0">
          <Link href="/" aria-current={crumbs.length === 0 ? 'page' : undefined} className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={27} height={28} className="h-6 w-auto sm:h-7" />
            CFOP Trainer
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.label} className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            <Chevron />
            {crumb.href ? (
              <Link href={crumb.href} className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
