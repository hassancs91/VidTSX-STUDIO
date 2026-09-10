import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Play, PenSquare, Info, Copy, Download, Trash2 } from 'lucide-react';

export type FlowCardAction = 'run' | 'edit' | 'details' | 'duplicate' | 'export' | 'remove';

interface Props {
  /** Built-ins are read-only: Edit and Remove are hidden, Duplicate makes an editable copy. */
  readOnly: boolean;
  onAction: (action: FlowCardAction) => void;
}

const ITEMS: { id: FlowCardAction; label: string; icon: typeof Play; editable?: boolean; danger?: boolean }[] = [
  { id: 'run', label: 'Run', icon: Play },
  { id: 'edit', label: 'Edit', icon: PenSquare, editable: true },
  { id: 'details', label: 'Details', icon: Info },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'export', label: 'Export…', icon: Download },
  { id: 'remove', label: 'Remove', icon: Trash2, editable: true, danger: true },
];

/** The same card menu the agents gallery has (flows plan §1.8). */
export function FlowCardMenu({ readOnly, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Flow menu"
        className="p-1 rounded bg-app-deep/80 text-text-muted hover:text-text-primary"
        data-flow-menu
      >
        <MoreHorizontal size={12} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-[150px] bg-app-surface rounded-[6px] shadow-lg z-50 py-1"
          style={{ border: '0.5px solid var(--color-border)' }}
          role="menu"
        >
          {ITEMS.filter((item) => !(readOnly && item.editable)).map(({ id, label, icon: Icon, danger }) => (
            <button
              key={id}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAction(id);
              }}
              className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-app-hover ${
                danger ? 'text-accent-red' : 'text-text-secondary'
              }`}
              data-flow-menu-item={id}
            >
              <Icon size={11} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
