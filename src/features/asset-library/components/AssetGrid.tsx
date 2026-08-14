import { useState } from 'react';
import { AssetTile } from './AssetTile';
import { AssetContextMenu } from './AssetContextMenu';
import type { AssetEntry } from '../types';

interface AssetGridProps {
  entries: AssetEntry[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  moduleServerUrl: string | null;
  onSelect: (path: string) => void;
  onOpen: (path: string) => void;
  onCopyUrl: (path: string) => void;
  onCopyRawPath: (path: string) => void;
  onRename: (entry: AssetEntry) => void;
  onDelete: (entry: AssetEntry) => void;
  onMove: (sourcePath: string, targetFolder: string) => void;
  /** Optional per-tile subtitle (folder size, description). */
  subtitleFor?: (entry: AssetEntry) => string | undefined;
}

interface MenuState {
  entry: AssetEntry;
  position: { x: number; y: number };
}

const DRAG_MIME = 'application/x-vidtsx-asset-path';

export function AssetGrid(props: AssetGridProps) {
  const {
    entries,
    loading,
    error,
    selectedPath,
    moduleServerUrl,
    onSelect,
    onOpen,
    onCopyUrl,
    onCopyRawPath,
    onRename,
    onDelete,
    onMove,
    subtitleFor,
  } = props;

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  if (loading) {
    return <div className="p-8 text-center text-text-muted text-[12px]">Loading…</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-accent-red text-[12px]">{error}</div>;
  }
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center text-text-muted text-[12px]">
        No files here yet.<br />
        Click <span className="text-text-secondary">Import</span> to add some.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1 p-2">
        {entries.map((entry) => (
          <AssetTile
            key={entry.node.path}
            entry={entry}
            selected={selectedPath === entry.node.path}
            moduleServerUrl={moduleServerUrl}
            subtitle={subtitleFor?.(entry)}
            isDropTarget={dropTargetPath === entry.node.path}
            onOpen={() => onOpen(entry.node.path)}
            onSelect={() => onSelect(entry.node.path)}
            onCopyPath={() => onCopyUrl(entry.node.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ entry, position: { x: e.clientX, y: e.clientY } });
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, entry.node.path);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (entry.node.type !== 'folder') return;
              const source = e.dataTransfer.types.includes(DRAG_MIME);
              if (!source) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropTargetPath(entry.node.path);
            }}
            onDragLeave={() => {
              if (dropTargetPath === entry.node.path) setDropTargetPath(null);
            }}
            onDrop={(e) => {
              if (entry.node.type !== 'folder') return;
              const sourcePath = e.dataTransfer.getData(DRAG_MIME);
              setDropTargetPath(null);
              if (!sourcePath || sourcePath === entry.node.path) return;
              e.preventDefault();
              onMove(sourcePath, entry.node.path);
            }}
          />
        ))}
      </div>

      {menu && (
        <AssetContextMenu
          entry={menu.entry}
          position={menu.position}
          onClose={() => setMenu(null)}
          onCopyUrl={() => { onCopyUrl(menu.entry.node.path); setMenu(null); }}
          onCopyRawPath={() => { onCopyRawPath(menu.entry.node.path); setMenu(null); }}
          onRename={() => { onRename(menu.entry); setMenu(null); }}
          onDelete={() => { onDelete(menu.entry); setMenu(null); }}
        />
      )}
    </>
  );
}
