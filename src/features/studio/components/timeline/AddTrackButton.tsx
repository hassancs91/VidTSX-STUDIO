import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { StudioTrackKind } from '../../types';
import { FloatingMenu } from './FloatingMenu';

interface Props {
  onAdd: (kind: StudioTrackKind) => void;
}

/** "+" in the track-header column's top cell: adds a video/overlay/audio track. */
export function AddTrackButton({ onAdd }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <button
        ref={buttonRef}
        title="Add track"
        aria-label="Add track"
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          setMenuAt(rect ? { x: rect.left, y: rect.bottom + 2 } : { x: 8, y: 8 });
        }}
        className="flex items-center gap-0.5 px-1 h-[16px] rounded-[4px] text-[9px] text-text-ghost hover:bg-app-hover hover:text-text-secondary transition-colors"
      >
        <Plus size={10} strokeWidth={1.75} />
        Track
      </button>
      {menuAt && (
        <FloatingMenu
          x={menuAt.x}
          y={menuAt.y}
          items={[
            { id: 'video', label: 'Video track' },
            { id: 'overlay', label: 'Overlay track' },
            { id: 'audio', label: 'Audio track' },
          ]}
          onPick={(id) => onAdd(id as StudioTrackKind)}
          onClose={() => setMenuAt(null)}
        />
      )}
    </>
  );
}
