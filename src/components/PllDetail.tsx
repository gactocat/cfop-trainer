'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getPllDefinition } from '@/data/pll-definitions';
import { useAlgorithms } from '@/hooks/useAlgorithms';
import { useT } from '@/hooks/useT';
import { casePracticePath } from '@/lib/practice-pages';
import { type PllId } from '@/types/pll';
import { AlgorithmForm } from './AlgorithmForm';
import { AlgorithmRow } from './AlgorithmRow';
import { Pll3DPlayer } from './Pll3DPlayer';
import { PllLLView } from './PllLLView';
import { SmartSolveHistory } from './SmartSolveHistory';
import { buttonClass, CARD, LINK, Segmented } from './ui';

type CubeView = '2d' | '3d';

interface PllDetailProps {
  pllId: PllId;
}

export function PllDetail({ pllId }: PllDetailProps) {
  const { t } = useT();
  const def = getPllDefinition(pllId);
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
        <p>{t('pll.detail.notFound', { id: pllId })}</p>
        <Link href="/pll" className={`${LINK} text-sm`}>
          {t('pll.detail.backToAll')}
        </Link>
      </div>
    );
  }

  return (
    <div data-ui="PllDetail" className="space-y-6">
      {/* The header shows the case's name; the heading stays for screen readers. */}
      <h1 className="sr-only">{def.name}</h1>
      <div className="flex flex-col md:flex-row md:items-start md:justify-end gap-6">
        <div className="flex flex-col items-center md:items-end gap-2">
          <Segmented
            label={t('pll.detail.cubePreview')}
            value={view}
            onChange={setView}
            options={[
              { value: '2d', label: '2D' },
              { value: '3d', label: '3D', disabled: !star, title: star ? undefined : t('pll.detail.starToPreview3d') },
            ]}
          />
          {(view === '2d' || !star) && (
            <div className="rounded-xl p-2 bg-zinc-100 dark:bg-zinc-900">
              <PllLLView pllId={pllId} auf={displayAuf} algorithm={star?.algorithm} size={220} />
            </div>
          )}
        </div>
      </div>

      {view === '3d' && star && (
        <div className="rounded-xl p-2 bg-zinc-100 dark:bg-zinc-900">
          <Pll3DPlayer
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
          <p className="text-sm text-zinc-500">{t('common.loading')}</p>
        ) : records.length === 0 && !adding ? (
          <p className="text-sm text-zinc-500 py-6 text-center">{t('detail.noAlgorithms')}</p>
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
                onPractice={(algorithmId) => router.push(casePracticePath('pll', pllId, algorithmId))}
              />
            ))}
          </ul>
        )}
      </section>

      <SmartSolveHistory practice="pll" caseId={pllId} />

    </div>
  );
}
