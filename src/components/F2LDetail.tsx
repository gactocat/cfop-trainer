'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useT } from '@/hooks/useT';
import { casePracticePath } from '@/lib/practice-pages';
import type { F2LId } from '@/types/f2l';
import { F2LAlgorithmForm } from './F2LAlgorithmForm';
import { F2LAlgorithmRow } from './F2LAlgorithmRow';
import { F2L3DPlayer } from './F2L3DPlayer';
import { SmartSolveHistory } from './SmartSolveHistory';
import { buttonClass, CARD, LINK } from './ui';

interface F2LDetailProps {
  f2lId: F2LId;
}

export function F2LDetail({ f2lId }: F2LDetailProps) {
  const { t } = useT();
  const def = getF2LDefinition(f2lId);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const {
    ready,
    all,
    starredFor,
    add,
    update,
    setStar,
    remove,
    addTime,
    removeTime,
  } = useF2LAlgorithms();

  const records = useMemo(
    () =>
      all
        .filter((r) => r.f2lId === f2lId)
        .slice()
        .sort((a, b) => {
          if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
          return a.createdAt.localeCompare(b.createdAt);
        }),
    [all, f2lId],
  );

  const star = ready ? starredFor(f2lId) : null;

  if (!def) {
    return (
      <div className="space-y-4">
        <p>{t('f2l.detail.notFound', { id: f2lId })}</p>
        <Link href="/f2l" className={`${LINK} text-sm`}>
          {t('f2l.detail.backToAll')}
        </Link>
      </div>
    );
  }

  const displayAlg = star?.algorithm ?? def.primaryAlg;
  return (
    <div className="space-y-6">
      {/* The header shows the case's name; the heading stays for screen readers. */}
      <h1 className="sr-only">
        {t('common.f2lCase', { number: def.number })}
      </h1>

      <div className="rounded-lg p-2 bg-zinc-100 dark:bg-zinc-900">
        <F2L3DPlayer
          algorithm={displayAlg}
          setupAlg={def.setupAlg}
          auf={star?.auf ?? 'U0'}
          className="w-full max-w-2xl mx-auto aspect-square"
        />
      </div>

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t('detail.algorithms')}</h2>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={buttonClass('primary', 'sm')}
            >
              {t('detail.add')}
            </button>
          )}
        </header>

        {adding && (
          <div className={`${CARD} p-3`}>
            <F2LAlgorithmForm
              f2lId={f2lId}
              onSubmit={(algorithm, auf) => {
                add({ f2lId, algorithm, auf });
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {!ready ? (
          <p className="text-sm text-zinc-500">{t('common.loading')}</p>
        ) : records.length === 0 && !adding ? (
          <p className="text-sm text-zinc-500 py-6 text-center">{t('detail.noAlgorithms')}</p>
        ) : (
          <ul className="space-y-2">
            {records.map((record) => (
              <F2LAlgorithmRow
                key={record.id}
                record={record}
                onUpdate={update}
                onSetStar={setStar}
                onRemove={remove}
                onAddTime={addTime}
                onRemoveTime={removeTime}
                onPractice={(algorithmId) => router.push(casePracticePath('f2l', f2lId, algorithmId))}
              />
            ))}
          </ul>
        )}
      </section>

      <SmartSolveHistory practice="f2l" caseId={f2lId} />

    </div>
  );
}
