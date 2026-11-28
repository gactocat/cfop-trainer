'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getOLLDefinition } from '@/data/oll-definitions';
import { useOLLAlgorithms } from '@/hooks/useOLLAlgorithms';
import { useT } from '@/hooks/useT';
import { casePracticePath } from '@/lib/practice-pages';
import { type OLLId } from '@/types/oll';
import { OLLAlgorithmForm } from './OLLAlgorithmForm';
import { OLLAlgorithmRow } from './OLLAlgorithmRow';
import { OLL3DPlayer } from './OLL3DPlayer';
import { OLLLLView } from './OLLLLView';
import { SmartSolveHistory } from './SmartSolveHistory';
import { buttonClass, CARD, LINK, Segmented } from './ui';

type CubeView = '2d' | '3d';

interface OLLDetailProps {
  ollId: OLLId;
}

export function OLLDetail({ ollId }: OLLDetailProps) {
  const { t } = useT();
  const def = getOLLDefinition(ollId);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
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
        <Link href="/oll" className={`${LINK} text-sm`}>
          {t('oll.detail.backToAll')}
        </Link>
      </div>
    );
  }

  return (
    <div data-ui="OLLDetail" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-2">
          {/* The header shows the case's name; the heading stays for screen readers. */}
          <h1 className="sr-only">{def.name}</h1>
          <a href={`https://www.speedcubedb.com/a/3x3/OLL/OLL_${def.number}`} target="_blank" rel="noreferrer" className={`${LINK} inline-block text-sm`}>
            {t('oll.source')}
          </a>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <Segmented
            label={t('oll.detail.cubePreview')}
            value={view}
            onChange={setView}
            options={[
              { value: '2d', label: '2D' },
              { value: '3d', label: '3D', disabled: !star, title: star ? undefined : t('oll.detail.starToPreview3d') },
            ]}
          />
          {(view === '2d' || !star) && (
            <div className="rounded-xl p-2 bg-zinc-100 dark:bg-zinc-900">
              <OLLLLView ollId={ollId} auf={displayAuf} algorithm={star?.algorithm} size={220} />
            </div>
          )}
        </div>
      </div>

      {view === '3d' && star && (
        <div className="rounded-xl p-2 bg-zinc-100 dark:bg-zinc-900">
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
              className={buttonClass('primary', 'sm')}
            >
              {t('detail.add')}
            </button>
          )}
        </header>

        {adding && (
          <div className={`${CARD} p-3`}>
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
                onPractice={(algorithmId) => router.push(casePracticePath('oll', ollId, algorithmId))}
              />
            ))}
          </ul>
        )}
      </section>

      <SmartSolveHistory practice="oll" caseId={ollId} />

    </div>
  );
}
