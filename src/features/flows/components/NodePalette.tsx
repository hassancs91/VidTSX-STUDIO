import { AlertTriangle, GripVertical } from 'lucide-react';
import type { NodeSpec } from '@shared/types/flows';
import { useNodeSpecs } from '../hooks/useNodeSpecs';
import { CATEGORY_LABELS, CATEGORY_ORDER, needLabel } from '../services/node-style';

export const PALETTE_DRAG_TYPE = 'application/x-flow-node-type';

function PaletteItem({ spec }: { spec: NodeSpec }) {
  const unmet = spec.available === false ? (spec.needs ?? []) : [];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DRAG_TYPE, spec.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="
        flex items-center gap-2 px-2.5 py-2 rounded-md
        bg-app-surface hover:bg-app-hover cursor-grab active:cursor-grabbing
        transition-colors
      "
      style={{ border: '0.5px solid var(--color-border)' }}
      title={unmet.length > 0 ? `${spec.description} — needs ${unmet.map(needLabel).join(', ')}` : spec.description}
      data-palette-node={spec.id}
    >
      <GripVertical size={12} strokeWidth={1.4} className="text-text-dim shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-text-secondary truncate">{spec.label}</div>
        {(spec.priced || spec.nondeterministic) && (
          <div className="text-[9px] uppercase tracking-wider text-text-dim">
            {[spec.priced ? 'priced' : null, spec.nondeterministic ? 'varies' : null].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {unmet.length > 0 && <AlertTriangle size={11} strokeWidth={2} className="text-amber-400 shrink-0" />}
    </div>
  );
}

/** Grouped by the registry `category` (flows plan §1.8). Gated nodes stay
 *  listed with a chip, never filtered out, so users learn what a provider
 *  unlocks (§11). */
export function NodePalette() {
  const { status, specs, error } = useNodeSpecs();

  if (status === 'loading') {
    return <div className="p-3 text-[11px] text-text-dim">Loading nodes…</div>;
  }
  if (status === 'error') {
    return <div className="p-3 text-[11px] text-accent-red">{error ?? 'Nodes unavailable'}</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {CATEGORY_ORDER.map((cat) => {
        const group = specs.filter((s) => s.category === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">{CATEGORY_LABELS[cat]}</span>
            <div className="flex flex-col gap-1.5">
              {group.map((spec) => (
                <PaletteItem key={spec.id} spec={spec} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
