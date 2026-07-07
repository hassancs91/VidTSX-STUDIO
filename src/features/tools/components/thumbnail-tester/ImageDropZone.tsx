import { useState, useRef } from 'react';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

interface ImageDropZoneProps {
  label: string;
  imageDataUrl: string | null;
  aspectRatio: string;
  onDrop: (filePath: string) => void;
  onBrowse: () => void;
  onClear: () => void;
}

export function ImageDropZone({
  label,
  imageDataUrl,
  aspectRatio,
  onDrop,
  onBrowse,
  onClear,
}: ImageDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTENSIONS.includes(ext)) {
      onDrop((file as File & { path: string }).path);
    }
  };

  if (imageDataUrl) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-muted">{label}</span>
        <div className="relative group rounded-[6px] overflow-hidden" style={{ aspectRatio }}>
          <img
            src={imageDataUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClear}
            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={onBrowse}
        className={`
          flex flex-col items-center justify-center gap-1 rounded-[6px] cursor-pointer
          border border-dashed transition-colors
          ${isDragging ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover'}
        `}
        style={{ aspectRatio }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isDragging ? 'text-accent-light' : 'text-text-dim'}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className={`text-[10px] ${isDragging ? 'text-accent-light' : 'text-text-dim'}`}>
          Drop or click
        </span>
      </div>
    </div>
  );
}
