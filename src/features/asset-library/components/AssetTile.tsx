import { useState } from 'react';
import {
  FolderIcon,
  ImageIcon,
  VideoIcon,
  AudioIcon,
  FontIcon,
  CubeIcon,
  DocumentIcon,
  FilePlusIcon,
  CopyIcon,
} from '@shared/components/library-icons';
import type { AssetEntry } from '../types';

interface AssetTileProps {
  entry: AssetEntry;
  selected: boolean;
  moduleServerUrl: string | null;
  /** Optional line under the name (folder size, description) — replaces the ext line. */
  subtitle?: string;
  onOpen: () => void;
  onSelect: () => void;
  onCopyPath: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  isDropTarget: boolean;
}

function CategoryIcon({ entry }: { entry: AssetEntry }) {
  if (entry.node.type === 'folder') return <FolderIcon open={false} />;
  switch (entry.category) {
    case 'image': return <ImageIcon />;
    case 'video': return <VideoIcon />;
    case 'audio': return <AudioIcon />;
    case 'font': return <FontIcon />;
    case 'model3d': return <CubeIcon />;
    case 'data': return <DocumentIcon />;
    default: return <FilePlusIcon />;
  }
}

export function AssetTile({
  entry,
  selected,
  moduleServerUrl,
  subtitle,
  onOpen,
  onSelect,
  onCopyPath,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  isDropTarget,
}: AssetTileProps) {
  const isFolder = entry.node.type === 'folder';
  const isImage = entry.category === 'image';
  // Images preview themselves; a 3D model previews through the `<name>-preview.png`
  // sibling that "Save to asset library" writes next to it (plan §5 step 6) — when the
  // sibling is absent the request 404s and the tile falls back to the cube icon.
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewPath = isImage
    ? entry.node.path
    : entry.category === 'model3d' && entry.ext.toLowerCase() === '.glb'
      ? entry.node.path.replace(/\.glb$/i, '-preview.png')
      : null;
  const previewUrl = previewPath && moduleServerUrl && !previewFailed
    ? `${moduleServerUrl}/asset?path=${encodeURIComponent(previewPath)}`
    : null;

  return (
    <button
      type="button"
      draggable
      onDoubleClick={isFolder ? onOpen : undefined}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      title={entry.node.path}
      className={`
        group relative flex flex-col items-stretch gap-1.5
        w-[140px] p-2 rounded-md text-left
        transition-colors duration-100
        ${selected ? 'bg-app-active' : 'hover:bg-app-hover'}
        ${isDropTarget ? 'ring-2 ring-accent' : ''}
      `}
    >
      <div className={`
        relative w-full aspect-square rounded
        flex items-center justify-center overflow-hidden
        ${isFolder ? 'bg-app-deep' : 'bg-app-deep'}
      `}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={entry.node.name}
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <span className={`scale-[2.4] ${isFolder ? 'text-accent-light' : 'text-text-muted'}`}>
            <CategoryIcon entry={entry} />
          </span>
        )}
        {!isFolder && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onCopyPath(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onCopyPath();
              }
            }}
            className="
              absolute top-1 right-1
              opacity-0 group-hover:opacity-100
              w-6 h-6 rounded
              bg-app-surface text-text-muted hover:text-text-primary
              flex items-center justify-center
              transition-opacity
              cursor-pointer
            "
            title="Copy URL (paste as src)"
          >
            <CopyIcon />
          </span>
        )}
      </div>
      <div className="text-[11px] leading-tight text-text-muted truncate" title={entry.node.name}>
        {entry.node.name}
      </div>
      {subtitle ? (
        <div className="text-[9px] leading-tight text-text-dim truncate" title={subtitle}>
          {subtitle}
        </div>
      ) : (
        !isFolder &&
        entry.ext && (
          <div className="text-[9px] uppercase tracking-wider text-text-dim">
            {entry.ext.replace('.', '')}
          </div>
        )
      )}
    </button>
  );
}
