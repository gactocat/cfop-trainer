'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getF2LDefinition } from '@/data/f2l-definitions';
import { useF2LAlgorithms } from '@/hooks/useF2LAlgorithms';
import { useF2LRandomSolves } from '@/hooks/useF2LRandomSolves';
import { useT } from '@/hooks/useT';
import { formatSeconds } from '@/lib/stats';
import type { F2LId } from '@/types/f2l';
import { F2LAlgorithmForm } from './F2LAlgorithmForm';
import { F2LAlgorithmRow } from './F2LAlgorithmRow';
import { F2L3DPlayer } from './F2L3DPlayer';

interface F2LDetailProps {
  f2lId: F2LId;
}

export function F2LDetail({ f2lId }: F2LDetailProps) {
  const { t, tn } = useT();
  const def = getF2LDefinition(f2lId);
  const [adding, setAdding] = useState(false);
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
  const {
    bestFor: randomBestFor,
    ao5For: randomAo5For,
    solvesFor: randomSolvesFor,
  } = useF2LRandomSolves();

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
        <Link href="/f2l" className="text-emerald-600 hover:underline text-sm">
          {t('f2l.detail.backToAll')}
        </Link>
      </div>
    );
  }

  const displayAlg = star?.algorithm ?? def.primaryAlg;
  const randomSolves = ready ? randomSolvesFor(f2lId).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/f2l"
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {t('f2l.detail.all')}
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('common.f2lCase', { number: def.number })}
          </h1>
          <p className="text-sm text-zinc-500">{tn('common.algorithmsSaved', records.length)}</p>
          {randomSolves > 0 && (
            <p className="text-xs text-zinc-500">
              {t('detail.randomStats', {
                best: formatSeconds(randomBestFor(f2lId)),
                ao5: formatSeconds(randomAo5For(f2lId)),
                solves: tn('common.solves', randomSolves),
              })}
            </p>
          )}
        </div>
      </div>

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
              className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 font-medium"
            >
              {t('detail.add')}
            </button>
          )}
        </header>

        {adding && (
          <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
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
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
