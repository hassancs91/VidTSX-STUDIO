import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LibraryFolder } from '../types';
import { FolderIcon } from '@shared/components/library-icons';

interface MoveToFolderMenuProps {
  x: number;
  y: number;
  folders: LibraryFolder[];
  currentParentPath: string | null;
  onPick: (targetFolderPath: string | null) => void;
  onClose: () => void;
}

const MENU_WIDTH = 220;
const VIEWPORT_MARGIN = 8;

export function MoveToFolderMenu({
  x,
  y,
  folders,
  currentParentPath,
  onPick,
  onClose,
}: MoveToFolderMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Clamp to viewport after mount
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width + VIEWPORT_MARGIN > window.innerWidth) {
      left = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    }
    if (top + rect.height + VIEWPORT_MARGIN > window.innerHeight) {
      top = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    }
    setPosition({ left, top });
  }, [x, y]);

  // Dismiss on outside click and Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const isInsideFolder = currentParentPath !== null;
  const selectableFolders = folders.filter((f) => f.folderPath !== currentParentPath);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-app-surface rounded-[6px] shadow-lg overflow-hidden"
      style={{
        left: position.left,
        top: position.top,
        width: MENU_WIDTH,
        border: '0.5px solid var(--color-border)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 pt-2 pb-1 text-[10px] text-text-dim uppercase tracking-wider">
        Move to…
      </div>
      <div className="max-h-64 overflow-y-auto pb-1">
        {isInsideFolder && (
          <button
            onClick={() => onPick(null)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-text-secondary hover:bg-app-hover hover:text-text-primary transition-colors cursor-pointer text-left"
          >
            <span className="shrink-0 text-text-dim">
              <FolderIcon open={false} />
            </span>
            <span className="truncate">Root (outside folders)</span>
          </button>
        )}
        {selectableFolders.length === 0 && !isInsideFolder ? (
          <div className="px-2 py-2 text-[11px] text-text-dim text-center">
            No folders yet
          </div>
        ) : (
          selectableFolders.map((folder) => (
            <button
              key={folder.folderPath}
              onClick={() => onPick(folder.folderPath)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] text-text-secondary hover:bg-app-hover hover:text-text-primary transition-colors cursor-pointer text-left"
            >
              <span className="shrink-0 text-text-dim">
                <FolderIcon open={false} />
              </span>
              <span className="truncate">{folder.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
