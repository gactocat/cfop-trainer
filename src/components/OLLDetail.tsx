'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getOLLDefinition } from '@/data/oll-definitions';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useOLLRandomSolves } from '@/hooks/useOLLRandomSolves';
import { useT } from '@/hooks/useT';
import { formatSeconds } from '@/lib/stats';
import { type OLLId } from '@/types/oll';
import { OLLAlgorithmForm } from './OLLAlgorithmForm';
import { OLLAlgorithmRow } from './OLLAlgorithmRow';
import { OLL3DPlayer } from './OLL3DPlayer';
import { OLLLLView } from './OLLLLView';

type CubeView = '2d' | '3d';

interface OLLDetailProps {
  ollId: OLLId;
}

export function OLLDetail({ ollId }: OLLDetailProps) {
  const { t, tn } = useT();
  const def = getOLLDefinition(ollId);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<CubeView>('2d');
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
  } = useOLLAlgorithms();
  const {
    bestFor: randomBestFor,
    ao5For: randomAo5For,
    solvesFor: randomSolvesFor,
  } = useOLLRandomSolves();

  const records = useMemo(
    () =>
      all
        .filter((r) => r.ollId === ollId)
        .slice()
        .sort((a, b) => {
          if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
          return a.createdAt.localeCompare(b.createdAt);
        }),
    [all, ollId],
  );

  const star = ready ? starredFor(ollId) : null;
  const displayAuf = star?.auf ?? 'U0';

  if (!def) {
    return (
      <div className="space-y-4">
        <p>{t('oll.detail.notFound', { id: ollId })}</p>
        <Link href="/oll" className="text-emerald-600 hover:underline text-sm">
          {t('oll.detail.backToAll')}
        </Link>
      </div>
    );
  }

  const randomSolves = ready ? randomSolvesFor(ollId).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/oll"
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {t('oll.detail.all')}
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{def.name}</h1>
          <p className="text-sm text-zinc-500">{tn('common.algorithmsSaved', records.length)}</p>
          <a href={`https://www.speedcubedb.com/a/3x3/OLL/OLL_${def.number}`} target="_blank" rel="noreferrer" className="inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
            {t('oll.source')}
          </a>
          {randomSolves > 0 && (
            <p className="text-xs text-zinc-500">
              {t('detail.randomStats', {
                best: formatSeconds(randomBestFor(ollId)),
                ao5: formatSeconds(randomAo5For(ollId)),
                solves: tn('common.solves', randomSolves),
              })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <div
            role="tablist"
            aria-label={t('oll.detail.cubePreview')}
            className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 text-xs overflow-hidden"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === '2d'}
              onClick={() => setView('2d')}
              className={`px-3 py-1 font-medium ${
                view === '2d'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              2D
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === '3d'}
              disabled={!star}
              onClick={() => setView('3d')}
              className={`px-3 py-1 font-medium ${
                view === '3d'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
              title={star ? undefined : t('oll.detail.starToPreview3d')}
            >
              3D
            </button>
          </div>
          {(view === '2d' || !star) && (
            <div className="rounded-lg p-2 bg-zinc-100 dark:bg-zinc-900">
              <OLLLLView ollId={ollId} auf={displayAuf} algorithm={star?.algorithm} size={220} />
            </div>
          )}
        </div>
      </div>

      {view === '3d' && star && (
        <div className="rounded-lg p-2 bg-zinc-100 dark:bg-zinc-900">
          <OLL3DPlayer
            algorithm={star.algorithm}
            auf={star.auf}
            className="w-full max-w-2xl mx-auto aspect-square"
          />
        </div>
      )}

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
            <OLLAlgorithmForm
              ollId={ollId}
              onSubmit={(algorithm, auf) => {
                add({ ollId, auf, algorithm });
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
              <OLLAlgorithmRow
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
