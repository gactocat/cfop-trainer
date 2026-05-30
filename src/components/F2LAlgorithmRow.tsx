'use client';

import { useState } from 'react';
import { F2LAlgorithmForm } from './F2LAlgorithmForm';
import { TimeHistoryPanel } from './TimeHistoryPanel';
import { useF2LAufDisplay } from '@/hooks/useF2LAufDisplay';
import { prefixAuf } from '@/lib/f2l-auf';
import { averageOfN, bestSeconds, formatSeconds } from '@/lib/stats';
import type { F2LAlgorithmRecord } from '@/types/f2l';
import type { Auf } from '@/types/pll';

interface F2LAlgorithmRowProps {
  record: F2LAlgorithmRecord;
  onUpdate: (id: string, patch: { algorithm?: string; auf?: Auf }) => void;
  onSetStar: (id: string) => void;
  onRemove: (id: string) => void;
  onAddTime: (id: string, seconds: number) => void;
  onRemoveTime: (id: string, timeId: string) => void;
}

export function F2LAlgorithmRow({
  record,
  onUpdate,
  onSetStar,
  onRemove,
  onAddTime,
  onRemoveTime,
}: F2LAlgorithmRowProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { mode: aufMode } = useF2LAufDisplay();

  const best = bestSeconds(record.times);
  const ao5 = averageOfN(record.times, 5);

  return (
    <li
      className={`rounded-lg border ${
        record.isStarred
          ? 'border-amber-400 dark:border-amber-500'
          : 'border-zinc-200 dark:border-zinc-800'
      } bg-white dark:bg-zinc-900`}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              if (!record.isStarred) onSetStar(record.id);
            }}
            disabled={record.isStarred}
            className={`mt-1 text-lg leading-none ${
              record.isStarred
                ? 'text-amber-500 cursor-default'
                : 'text-zinc-300 hover:text-amber-400 dark:text-zinc-700'
            }`}
            aria-label={record.isStarred ? 'Starred (only one per F2L case)' : 'Set as starred'}
            title={record.isStarred ? 'Starred — shown on the F2L grid' : 'Set as starred'}
          >
            ★
          </button>

          <div className="flex-1 min-w-0">
            {editing ? (
              <F2LAlgorithmForm
                f2lId={record.f2lId}
                initialValue={record.algorithm}
                initialAuf={record.auf}
                submitLabel="Update"
                onSubmit={(algorithm, auf) => {
                  onUpdate(record.id, { algorithm, auf });
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <p className="font-mono text-sm break-words">
                {aufMode === 'cube' ? (
                  <>
                    <span className="inline-block min-w-[2.5em] mr-2 px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 align-middle">
                      {record.auf}
                    </span>
                    {record.algorithm}
                  </>
                ) : (
                  prefixAuf(record.auf, record.algorithm)
                )}
              </p>
            )}

            <div className="mt-2 flex items-center gap-4 text-xs">
              <span>
                Best:{' '}
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatSeconds(best)}
                </span>
              </span>
              <span>
                ao5:{' '}
                <span className="font-mono font-semibold">
                  {formatSeconds(ao5)}
                </span>
              </span>
              <span className="text-zinc-500">
                {record.times.length} solve{record.times.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {!editing && (
          <div className="mt-3 flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-expanded={expanded}
            >
              {expanded ? 'Close' : 'Times'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Delete this algorithm?')) onRemove(record.id);
              }}
              className="text-xs px-2 py-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <TimeHistoryPanel
            times={record.times}
            onAdd={(s) => onAddTime(record.id, s)}
            onRemove={(tid) => onRemoveTime(record.id, tid)}
          />
        </div>
      )}
    </li>
  );
}
