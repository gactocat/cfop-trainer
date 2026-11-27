'use client';

import { useT } from '@/hooks/useT';
import type { SelectionPreset } from '@/lib/selection-presets-store';
import { buttonClass, INPUT_SM } from './ui';

interface SelectionPresetsBarProps<Id extends string> {
  presets: SelectionPreset<Id>[];
  selected: Set<Id>;
  // Saving and deleting are only offered while picking cases; loading a set
  // is always available.
  selectionMode: boolean;
  onLoad: (ids: Id[]) => void;
  onSave: (name: string, ids: Id[]) => void;
  onDelete: (presetId: string) => void;
}

function sameSet<Id>(a: Set<Id>, b: Id[]): boolean {
  return a.size === b.length && b.every((id) => a.has(id));
}


export function SelectionPresetsBar<Id extends string>({
  presets,
  selected,
  selectionMode,
  onLoad,
  onSave,
  onDelete,
}: SelectionPresetsBarProps<Id>) {
  const { t } = useT();
  if (presets.length === 0 && !selectionMode) return null;

  // The set whose cases are exactly the current selection, if any. Drives the
  // dropdown value and which set the delete button targets, with no local
  // state to fall out of sync.
  const active = presets.find((p) => sameSet(selected, p.ids));

  const saveAs = () => {
    const name = window.prompt(t('selection.savePrompt'), active?.name ?? '');
    if (name && name.trim()) onSave(name, [...selected]);
  };

  const remove = () => {
    if (active && window.confirm(t('selection.confirmDelete', { name: active.name }))) {
      onDelete(active.id);
    }
  };

  // The parts flow with the selection tools around them (see ListHeaderActions).
  return (
    <div className="contents">
      {presets.length > 0 && (
        <select
          aria-label={t('selection.savedSetsAria')}
          value={active?.id ?? ''}
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) onLoad(preset.ids);
          }}
          className={`${INPUT_SM} max-w-[14rem]`}
        >
          <option value="">{t('selection.savedSets')}</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.ids.length})
            </option>
          ))}
        </select>
      )}
      {selectionMode && selected.size > 0 && (
        <button type="button" onClick={saveAs} className={buttonClass('secondary', 'sm')}>
          {t('selection.save')}
        </button>
      )}
      {selectionMode && active && (
        <button
          type="button"
          onClick={remove}
          className={buttonClass('danger', 'sm')}
        >
          {t('selection.deleteSet', { name: active.name })}
        </button>
      )}
    </div>
  );
}
