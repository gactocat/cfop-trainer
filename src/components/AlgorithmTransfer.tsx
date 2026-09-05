'use client';

import { useRef, useState } from 'react';
import { useT, type Translator } from '@/hooks/useT';
import { exportAlgorithms, importAlgorithms } from '@/lib/storage';
import {
  exportF2LAlgorithms,
  importF2LAlgorithms,
} from '@/lib/f2l-storage';
import { ImportError } from '@/lib/import-error';

type Kind = 'pll' | 'f2l';

interface Config {
  label: string;
  fileName: string;
  export: () => string;
  import: (json: string) => { imported: number };
}

const CONFIGS: Record<Kind, Config> = {
  pll: {
    label: 'PLL',
    fileName: 'cfop-pll-algorithms.json',
    export: exportAlgorithms,
    import: importAlgorithms,
  },
  f2l: {
    label: 'F2L',
    fileName: 'cfop-f2l-algorithms.json',
    export: exportF2LAlgorithms,
    import: importF2LAlgorithms,
  },
};

type Status =
  | { kind: 'idle' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function downloadJson(fileName: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importErrorMessage(err: unknown, kind: string, t: Translator['t']): string {
  if (err instanceof ImportError) {
    switch (err.code) {
      case 'invalid-json':
        return t('transfer.error.invalidJson');
      case 'unrecognized':
        return t('transfer.error.unrecognized');
      case 'wrong-kind':
        return t('transfer.error.wrongKind', { kind });
    }
  }
  return t('transfer.importFailed', { kind });
}

export function AlgorithmTransfer() {
  const { t, tn } = useT();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const pllInputRef = useRef<HTMLInputElement>(null);
  const f2lInputRef = useRef<HTMLInputElement>(null);

  const handleExport = (kind: Kind) => {
    const cfg = CONFIGS[kind];
    try {
      downloadJson(cfg.fileName, cfg.export());
      setStatus({ kind: 'success', message: t('transfer.exported', { kind: cfg.label }) });
    } catch {
      setStatus({ kind: 'error', message: t('transfer.exportFailed', { kind: cfg.label }) });
    }
  };

  const handleFile = async (kind: Kind, file: File) => {
    const cfg = CONFIGS[kind];
    if (!window.confirm(t('transfer.confirmImport', { kind: cfg.label }))) {
      return;
    }
    try {
      const text = await file.text();
      const { imported } = cfg.import(text);
      setStatus({
        kind: 'success',
        message: tn('transfer.imported', imported, { kind: cfg.label }),
      });
    } catch (err) {
      setStatus({ kind: 'error', message: importErrorMessage(err, cfg.label, t) });
    }
  };

  const onInputChange = (kind: Kind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleFile(kind, file);
  };

  const rowClass =
    'flex items-center gap-2';
  const btnClass =
    'inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors';

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t('transfer.title')}</h3>
        <p className="text-xs text-zinc-500">{t('transfer.description')}</p>
      </div>

      <div className="space-y-2">
        {(['pll', 'f2l'] as Kind[]).map((kind) => {
          const cfg = CONFIGS[kind];
          const ref = kind === 'pll' ? pllInputRef : f2lInputRef;
          return (
            <div key={kind} className={rowClass}>
              <span className="w-10 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {cfg.label}
              </span>
              <button type="button" className={btnClass} onClick={() => handleExport(kind)}>
                {t('common.export')}
              </button>
              <button type="button" className={btnClass} onClick={() => ref.current?.click()}>
                {t('common.import')}
              </button>
              <input
                ref={ref}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onInputChange(kind)}
              />
            </div>
          );
        })}
      </div>

      {status.kind !== 'idle' && (
        <p
          className={
            status.kind === 'error'
              ? 'text-xs text-red-600 dark:text-red-400'
              : 'text-xs text-emerald-600 dark:text-emerald-400'
          }
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
