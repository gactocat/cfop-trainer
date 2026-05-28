'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { type PllId } from '@/types/pll';
import { AlgorithmForm } from './AlgorithmForm';
import { AlgorithmRow } from './AlgorithmRow';
import { Pll3DPlayer } from './Pll3DPlayer';
import { PllImage } from './PllImage';

type CubeView = '2d' | '3d';

interface PllDetailProps {
  pllId: PllId;
}

export function PllDetail({ pllId }: PllDetailProps) {
  const def = getPllDefinition(pllId);
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
  } = useAlgorithms();

  const records = useMemo(
    () =>
      all
        .filter((r) => r.pllId === pllId)
        .slice()
        .sort((a, b) => {
          if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
          return a.createdAt.localeCompare(b.createdAt);
        }),
    [all, pllId],
  );

  const star = ready ? starredFor(pllId) : null;
  const displayAuf = star?.auf ?? 'U0';

  if (!def) {
    return (
      <div className="space-y-4">
        <p>PLL not found: {pllId}</p>
        <Link href="/" className="text-emerald-600 hover:underline text-sm">
          ← Back to all PLLs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All PLLs
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{def.name}</h1>
          <p className="text-sm text-zinc-500">
            {records.length} algorithm{records.length === 1 ? '' : 's'} saved
          </p>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <div
            role="tablist"
            aria-label="Cube preview"
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
              title={star ? undefined : 'Star an algorithm to preview in 3D'}
            >
              3D
            </button>
          </div>
          {(view === '2d' || !star) && (
            <div className="rounded-lg p-2 bg-zinc-100 dark:bg-zinc-900">
              <PllImage pllId={pllId} auf={displayAuf} size={220} />
            </div>
          )}
        </div>
      </div>

      {view === '3d' && star && (
        <div className="rounded-lg p-2 bg-zinc-100 dark:bg-zinc-900">
          <Pll3DPlayer
            algorithm={star.algorithm}
            auf={star.auf}
            className="w-full max-w-2xl mx-auto aspect-square"
          />
        </div>
      )}

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Algorithms</h2>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 font-medium"
            >
              + Add
            </button>
          )}
        </header>

        {adding && (
          <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
            <AlgorithmForm
              pllId={pllId}
              onSubmit={(algorithm, auf) => {
                add({ pllId, auf, algorithm });
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {!ready ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : records.length === 0 && !adding ? (
          <p className="text-sm text-zinc-500 py-6 text-center">
            No algorithms saved yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {records.map((record) => (
              <AlgorithmRow
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
