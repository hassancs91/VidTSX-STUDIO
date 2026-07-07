import { GripVertical } from 'lucide-react';
import { CATEGORY_LABELS, NODE_TYPES_BY_CATEGORY } from '../nodes';
import type { NodeCategory, NodeTypeDefinition } from '../nodes/types';

export const PALETTE_DRAG_TYPE = 'application/x-flow-node-type';

function PaletteItem({ node }: { node: NodeTypeDefinition }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DRAG_TYPE, node.typeId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="
        flex items-center gap-2 px-2.5 py-2 rounded-md
        bg-app-surface hover:bg-app-hover cursor-grab active:cursor-grabbing
        transition-colors
      "
      style={{ border: '0.5px solid var(--color-border)' }}
      title={node.description}
    >
      <GripVertical size={12} strokeWidth={1.4} className="text-text-dim shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-text-secondary truncate">{node.label}</div>
      </div>
    </div>
  );
}

export function NodePalette() {
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto h-full">
      {(Object.keys(NODE_TYPES_BY_CATEGORY) as NodeCategory[]).map((cat) => {
        const nodes = NODE_TYPES_BY_CATEGORY[cat];
        if (nodes.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">
              {CATEGORY_LABELS[cat]}
            </span>
            <div className="flex flex-col gap-1.5">
              {nodes.map((node) => (
                <PaletteItem key={node.typeId} node={node} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
