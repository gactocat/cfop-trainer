'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { useT } from '@/hooks/useT';
import { F2L_IDS, type F2LId } from '@/types/f2l';
import { OLL_IDS, type OLLId } from '@/types/oll';
import type { PllId } from '@/types/pll';

const STAGES = { f2l: 'F2L', oll: 'OLL', pll: 'PLL' } as const;
/** Solves from a scramble, under /solve. */
const SOLVES: Record<string, string> = { cfop: 'CFOP' };
type Stage = keyof typeof STAGES;
const isStage = (segment: string | undefined): segment is Stage => !!segment && segment in STAGES;

const HOME = 'CFOP Trainer';
type Translate = ReturnType<typeof useT>['t'];
type Page = { title: string; up: { href: string; label: string } };

function caseName(stage: Stage, id: string, t: Translate): string | undefined {
  if (stage === 'pll') return getPllDefinition(id as PllId)?.name;
  // OLL-21 and F2L-17 carry their number.
  const number = id.slice(4);
  if (stage === 'oll') return OLL_IDS.includes(id as OLLId) ? `OLL ${number}` : undefined;
  return F2L_IDS.includes(id as F2LId) ? t('common.f2lCase', { number }) : undefined;
}

// The page's title and the page one level up: a case leads to its list,
// everything else to the top page. Null on the top page itself (and on
// /account, which shows it).
function pageFor(pathname: string, t: Translate): Page | null {
  const [first, id] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const home = { href: '/', label: HOME };
  if (first === 'privacy' || first === 'support') return { title: t(`${first}.title`), up: home };
  if (first === 'solve') return id && id in SOLVES ? { title: SOLVES[id], up: home } : null;
  if (!isStage(first)) return null;
  const name = id ? caseName(first, id, t) : undefined;
  return name
    ? { title: name, up: { href: `/${first}`, label: STAGES[first] } }
    : { title: STAGES[first], up: home };
}

// The app's static export for iOS adds a trailing slash.
const normalize = (path: string) => path.replace(/\/+$/, '') || '/';

// The page shown before this one in this tab, kept so that going up to the
// page just left can be a step back in history instead: the browser then
// restores where that page was scrolled to, down a long list for example.
let previousPath: string | null = null;
let currentPath: string | null = null;
function track(pathname: string) {
  const path = normalize(pathname);
  if (path === currentPath) return;
  previousPath = currentPath;
  currentPath = path;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className="size-6">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

// The header's left side: on the top page the app's name, elsewhere a back
// button to the page one level up and the page's title.
export function HeaderTitle() {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  useEffect(() => { track(pathname); }, [pathname]);
  const page = pageFor(pathname, t);

  if (!page) {
    return (
      <Link href="/" aria-current="page" className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
        <Image src="/logo.svg" alt="" width={27} height={28} className="h-6 w-auto sm:h-7" />
        {HOME}
      </Link>
    );
  }

  const label = t('nav.backTo', { page: page.up.label });
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (previousPath !== page.up.href) return;
    event.preventDefault();
    router.back();
  };
  return (
    <div className="flex min-w-0 shrink items-center gap-1">
      <Link href={page.up.href} onClick={back} aria-label={label} title={label}
        className="-ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
        <BackIcon />
      </Link>
      <span className="truncate text-base font-semibold tracking-tight sm:text-lg">{page.title}</span>
    </div>
  );
}
