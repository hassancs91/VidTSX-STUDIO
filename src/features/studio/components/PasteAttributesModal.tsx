import { useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import type { PasteAttributeCategory } from '../types';

export interface PasteCategoryOption {
  key: PasteAttributeCategory;
  label: string;
  // False when none of the selected target clips can receive this group — shown
  // disabled so the user understands why it won't apply.
  available: boolean;
}

interface PasteAttributesModalProps {
  // Copied groups, in display order. Only groups the source actually captured
  // are passed in.
  options: PasteCategoryOption[];
  // Pre-checked groups (remembered from the last paste), intersected with what's
  // available this time.
  initialSelected: Set<PasteAttributeCategory>;
  targetCount: number;
  sourceLabel: string;
  onApply: (selected: Set<PasteAttributeCategory>) => void;
  onClose: () => void;
}

function CheckBox({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  return (
    <span
      className="flex items-center justify-center w-[15px] h-[15px] rounded-[3px] shrink-0"
      style={{
        border: `1px solid ${checked && !disabled ? 'var(--color-accent)' : 'var(--color-border-hover)'}`,
        backgroundColor: checked && !disabled ? 'var(--color-accent)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked && (
        <svg width={9} height={9} viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5.2L4 7.2L8 2.8" />
        </svg>
      )}
    </span>
  );
}

export function PasteAttributesModal({
  options,
  initialSelected,
  targetCount,
  sourceLabel,
  onApply,
  onClose,
}: PasteAttributesModalProps) {
  const [selected, setSelected] = useState<Set<PasteAttributeCategory>>(() => {
    const s = new Set<PasteAttributeCategory>();
    for (const o of options) if (o.available && initialSelected.has(o.key)) s.add(o.key);
    // If the remembered picks don't apply this time, default to all available.
    if (s.size === 0) for (const o of options) if (o.available) s.add(o.key);
    return s;
  });

  const availableKeys = options.filter((o) => o.available).map((o) => o.key);
  const allAvailableChecked = availableKeys.length > 0 && availableKeys.every((k) => selected.has(k));

  const toggle = (key: PasteAttributeCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allAvailableChecked ? new Set() : new Set(availableKeys));
  };

  const nothingAvailable = availableKeys.length === 0;

  return (
    <Modal isOpen onClose={onClose} title="Paste attributes">
      <div className="flex flex-col gap-[12px] min-w-[300px]">
        <p className="text-[11px] text-text-muted">
          Apply from <span className="text-text-secondary">{sourceLabel}</span> to{' '}
          <span className="text-text-secondary">
            {targetCount} {targetCount === 1 ? 'clip' : 'clips'}
          </span>
          :
        </p>

        {nothingAvailable ? (
          <p className="text-[11px] text-text-dim py-[8px]">
            Nothing copied applies to the selected clip{targetCount === 1 ? '' : 's'}.
          </p>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {options.map((o) => (
              <button
                key={o.key}
                disabled={!o.available}
                onClick={() => toggle(o.key)}
                className={`flex items-center gap-[8px] px-[8px] h-[30px] rounded-[5px] text-left text-[12px] transition-colors ${
                  o.available
                    ? 'text-text-secondary hover:bg-app-hover cursor-pointer'
                    : 'text-text-dim cursor-not-allowed'
                }`}
                title={o.available ? undefined : 'No selected clip supports this'}
              >
                <CheckBox checked={selected.has(o.key)} disabled={!o.available} />
                {o.label}
                {!o.available && <span className="text-[10px] text-text-dim ml-auto">n/a</span>}
              </button>
            ))}
          </div>
        )}

        {!nothingAvailable && (
          <button
            onClick={toggleAll}
            className="self-start text-[10px] text-text-muted hover:text-accent-light transition-colors"
          >
            {allAvailableChecked ? 'Clear all' : 'Select all'}
          </button>
        )}

        <div
          className="flex items-center justify-end gap-[8px] pt-[10px]"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={selected.size === 0}
            onClick={() => onApply(selected)}
          >
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
