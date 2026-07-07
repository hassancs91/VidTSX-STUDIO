import { useState, useCallback } from 'react';
import type { GalleryFolder } from '../types';

interface FolderCardProps {
  folder: GalleryFolder;
  onClick: (folderId: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDrop: (videoId: string, folderId: string) => void;
}

export function FolderCard({ folder, onClick, onRename, onDelete, onDrop }: FolderCardProps) {
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('text/video-id')) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDropEvent = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const videoId = e.dataTransfer.getData('text/video-id');
      if (videoId) {
        onDrop(videoId, folder.id);
      }
    },
    [folder.id, onDrop],
  );

  const handleRenameSubmit = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed);
    }
    setEditing(false);
  }, [editName, folder.id, folder.name, onRename]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameSubmit();
      } else if (e.key === 'Escape') {
        setEditName(folder.name);
        setEditing(false);
      }
    },
    [handleRenameSubmit, folder.name],
  );

  return (
    <div
      className={`relative rounded-lg overflow-hidden cursor-pointer group border transition-colors ${
        dragOver
          ? 'border-accent bg-accent/10'
          : 'border-border bg-app-surface hover:border-text-dim'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editing && onClick(folder.id)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
    >
      <div className="aspect-square overflow-hidden">
        {folder.coverThumbnailUrls.length > 0 ? (
          <div
            className="w-full h-full grid"
            style={{
              gridTemplateColumns: folder.coverThumbnailUrls.length === 1 ? '1fr' : '1fr 1fr',
              gridTemplateRows: folder.coverThumbnailUrls.length <= 2 ? '1fr' : '1fr 1fr',
              gap: '1px',
            }}
          >
            {folder.coverThumbnailUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-full h-full object-cover opacity-60"
                loading="lazy"
              />
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              width={32}
              height={32}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-dim"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="px-2 py-1.5">
        {editing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-[11px] bg-app-base border border-accent rounded px-1 py-0.5 text-text-primary focus:outline-none"
            autoFocus
          />
        ) : (
          <div className="text-[11px] text-text-primary font-medium truncate">{folder.name}</div>
        )}
        <div className="text-[10px] text-text-dim">
          {folder.videoCount} video{folder.videoCount !== 1 ? 's' : ''}
        </div>
      </div>

      {hovered && !editing && (
        <div className="absolute top-1 right-1 flex gap-0.5">
          <button
            type="button"
            className="w-[22px] h-[22px] rounded flex items-center justify-center bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-colors"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              setEditName(folder.name);
              setEditing(true);
            }}
          >
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            className="w-[22px] h-[22px] rounded flex items-center justify-center bg-black/50 hover:bg-red-600/80 text-white/80 hover:text-white transition-colors"
            title="Delete folder"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder.id);
            }}
          >
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}

      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/20 pointer-events-none">
          <span className="text-[11px] text-accent font-medium">Drop here</span>
        </div>
      )}
    </div>
  );
}
