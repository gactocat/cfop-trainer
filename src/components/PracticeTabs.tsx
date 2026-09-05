'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/hooks/useT';

type Practice = 'pll' | 'f2l';

const TABS: ReadonlyArray<{ practice: Practice; label: string; href: string }> = [
  { practice: 'pll', label: 'PLL', href: '/pll' },
  { practice: 'f2l', label: 'F2L', href: '/f2l' },
];

function activeFor(pathname: string | null): Practice {
  if (pathname?.startsWith('/f2l')) return 'f2l';
  return 'pll';
}

export function PracticeTabs() {
  const pathname = usePathname();
  const active = activeFor(pathname);
  const { t } = useT();

  return (
    <nav
      aria-label={t('common.practice')}
      className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5"
    >
      {TABS.map((tab) => {
        const isActive = tab.practice === active;
        return (
          <Link
            key={tab.practice}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`px-3 py-1 text-sm font-semibold tracking-tight rounded transition-colors ${
              isActive
                ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
