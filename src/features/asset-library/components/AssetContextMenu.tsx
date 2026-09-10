import { useEffect, useRef } from 'react';
import { CopyIcon, PencilIcon, TrashIcon } from '@shared/components/library-icons';
import { RunFlowMenu } from '@renderer/components/flows/RunFlowMenu';
import type { AssetEntry } from '../types';

interface AssetContextMenuProps {
  entry: AssetEntry;
  position: { x: number; y: number };
  onClose: () => void;
  onCopyUrl: () => void;
  onCopyRawPath: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function AssetContextMenu({
  entry,
  position,
  onClose,
  onCopyUrl,
  onCopyRawPath,
  onRename,
  onDelete,
}: AssetContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isFolder = entry.node.type === 'folder';
  // W8 Stage 6 (flows plan §1.8): a video or an image can be handed to a flow
  // that takes one — the run form opens with the file on that param.
  const flowKind = !isFolder && (entry.category === 'video' || entry.category === 'image') ? entry.category : null;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="
        fixed z-50 min-w-[180px] py-1 rounded-md
        bg-app-surface text-text-secondary text-[12px]
        shadow-lg
      "
      style={{
        left: position.x,
        top: position.y,
        border: '0.5px solid var(--color-border)',
      }}
    >
      {!isFolder && (
        <>
          <MenuItem icon={<CopyIcon />} label="Copy URL (for src)" onClick={onCopyUrl} />
          <MenuItem icon={<CopyIcon />} label="Copy file path" onClick={onCopyRawPath} />
          <MenuDivider />
        </>
      )}
      {flowKind && (
        <>
          <RunFlowMenu kind={flowKind} value={entry.node.path} onDone={onClose} />
          <MenuDivider />
        </>
      )}
      <MenuItem icon={<PencilIcon />} label="Rename" onClick={onRename} />
      <MenuItem icon={<TrashIcon />} label="Delete" onClick={onDelete} destructive />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-3 py-1.5 text-left
        hover:bg-app-hover
        ${destructive ? 'text-accent-red' : ''}
      `}
    >
      <span className="opacity-70">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1" style={{ borderTop: '0.5px solid var(--color-border)' }} />;
}
