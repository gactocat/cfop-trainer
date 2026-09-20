'use client';

import Link from 'next/link';
import { useT } from '@/hooks/useT';

export function PublicLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  return <nav aria-label={t('legal.links')} className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
    <Link href="/privacy" onClick={onNavigate} className="hover:underline">{t('privacy.title')}</Link>
    <Link href="/support" onClick={onNavigate} className="hover:underline">{t('support.title')}</Link>
  </nav>;
}
