'use client';

import { useT } from '@/hooks/useT';
import { openAccountDialog } from '@/lib/app-dialog';

export function PublicPage({ kind }: { kind: 'privacy' | 'support' }) {
  const { t } = useT();
  const sections = kind === 'privacy'
    ? ['operator', 'data', 'purpose', 'providers', 'retention', 'choices', 'changes'] as const
    : ['practice', 'sync', 'email', 'delete', 'contact'] as const;
  return <article className="mx-auto max-w-2xl space-y-6 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
    <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{t(`${kind}.title`)}</h1>
    <p>{t(`${kind}.intro`)}</p>
    {sections.map((section) => <section key={section} className="space-y-2">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t(`${kind}.${section}.title` as Parameters<typeof t>[0])}</h2>
      <p className="whitespace-pre-line">{t(`${kind}.${section}.body` as Parameters<typeof t>[0])}</p>
      {section === 'delete' && <button type="button" onClick={openAccountDialog} className="text-emerald-700 underline dark:text-emerald-400">{t('account.open')}</button>}
    </section>)}
    <p><a href="mailto:gactocat@gmail.com" className="break-all text-emerald-700 underline dark:text-emerald-400">gactocat@gmail.com</a></p>
  </article>;
}
