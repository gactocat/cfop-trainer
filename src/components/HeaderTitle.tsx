'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, type MouseEvent } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { useT } from '@/hooks/useT';
import { useMounted } from '@/hooks/useMounted';
import { practicePageOf, practicePathOf } from '@/lib/practice-pages';
import { SOLVE_MODE, SOLVE_MODES } from '@/lib/solve/solve-modes';
import { solvePageOf, solveRecordsPath } from '@/lib/solve/solve-pages';
import { F2L_IDS, type F2LId } from '@/types/f2l';
import { OLL_IDS, type OLLId } from '@/types/oll';
import type { PllId } from '@/types/pll';
import { iconButtonClass } from './ui';

const STAGES = { f2l: 'F2L', oll: 'OLL', pll: 'PLL' } as const;
const RANDOM_TITLE = { f2l: 'trainer.f2lTitle', oll: 'trainer.ollTitle', pll: 'trainer.pllTitle' } as const;
/** Solves from a scramble, under /solve: each kind's label (CFOP, Cross, F2L, LL). */
const SOLVES: Record<string, string> = Object.fromEntries(SOLVE_MODES.map((mode) => [SOLVE_MODE[mode].slug, SOLVE_MODE[mode].label]));
type Stage = keyof typeof STAGES;
const isStage = (segment: string | undefined): segment is Stage => !!segment && segment in STAGES;

const HOME = 'CFOP Trainer';
type Translate = ReturnType<typeof useT>['t'];
/** `keepQuery`: the page up is named by the same query (a case practice's algorithm). */
type Page = { title: string; up: { href: string; label: string; keepQuery?: boolean } };

function caseName(stage: Stage, id: string, t: Translate): string | undefined {
  if (stage === 'pll') return getPllDefinition(id as PllId)?.name;
  // OLL-21 and F2L-17 carry their number.
  const number = id.slice(4);
  if (stage === 'oll') return OLL_IDS.includes(id as OLLId) ? `OLL ${number}` : undefined;
  return F2L_IDS.includes(id as F2LId) ? t('common.f2lCase', { number }) : undefined;
}

// The page's title and the page one level up: a case and random practice
// lead to their list, a case's practice to the case, a practice's session
// to the practice, a solve's records to the solve and one solve of them to
// the records, everything else to the top page. Null on the top page itself
// (and on /account, which shows it).
function pageFor(pathname: string, t: Translate): Page | null {
  const [first, id] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const home = { href: '/', label: HOME };
  const practice = practicePageOf(pathname);
  if (practice?.session) {
    const label = practice.kind === 'random' ? t(RANDOM_TITLE[practice.practice]) : t('casePractice.title', { name: caseName(practice.practice, practice.caseId, t) ?? practice.caseId });
    return { title: t('trainer.noScramble.session'), up: { href: practicePathOf(practice), label, keepQuery: practice.kind === 'case' } };
  }
  const solve = solvePageOf(pathname);
  if (solve?.kind === 'records') return { title: t('solve.records.title'), up: { href: SOLVE_MODE[solve.mode].href, label: SOLVE_MODE[solve.mode].label } };
  if (solve?.kind === 'record') return { title: t('solve.detail.title'), up: { href: solveRecordsPath(solve.mode), label: t('solve.records.title') } };
  if (practice?.kind === 'random') {
    return { title: t(RANDOM_TITLE[practice.practice]), up: { href: `/${practice.practice}`, label: STAGES[practice.practice] } };
  }
  if (practice?.kind === 'case') {
    const name = caseName(practice.practice, practice.caseId, t);
    return name ? { title: t('casePractice.title', { name }), up: { href: `/${practice.practice}/${encodeURIComponent(practice.caseId)}`, label: name } } : null;
  }
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

/**
 * A link up to `href` that steps back in history instead when the page
 * just left is that one, so it comes back as it was left (scrolled down a
 * long list, for example): the link's onClick.
 */
export function useUpLink(href: string) {
  const router = useRouter();
  return useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (previousPath !== normalize(href.split('?')[0])) return;
    event.preventDefault();
    router.back();
  }, [href, router]);
}

/**
 * Go up to `href` from code (after deleting what the page showed): a step
 * back when the page just left is that one, else in place of this page.
 */
export function goUp(router: ReturnType<typeof useRouter>, href: string) {
  if (previousPath === normalize(href.split('?')[0])) router.back();
  else router.replace(href);
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
  const pathname = usePathname() ?? '/';
  useEffect(() => { track(pathname); }, [pathname]);
  const page = pageFor(pathname, t);
  const mounted = useMounted();
  // The query is known in the browser only.
  const upHref = page ? `${page.up.href}${page.up.keepQuery && mounted ? window.location.search : ''}` : '/';
  const back = useUpLink(upHref);

  if (!page) {
    return (
      <Link href="/" aria-current="page" className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
        <Image src="/logo.svg" alt="" width={27} height={28} className="h-6 w-auto sm:h-7" />
        {HOME}
      </Link>
    );
  }

  const label = t('nav.backTo', { page: page.up.label });
  return (
    <div className="flex min-w-0 shrink items-center gap-1">
      <Link href={upHref} onClick={back} aria-label={label} title={label}
        className={`${iconButtonClass()} -ml-1.5`}>
        <BackIcon />
      </Link>
      <span className="truncate text-base font-semibold tracking-tight sm:text-lg">{page.title}</span>
    </div>
  );
}
