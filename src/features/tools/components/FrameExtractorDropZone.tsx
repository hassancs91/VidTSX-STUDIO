import { useState, useRef } from 'react';

interface FrameExtractorDropZoneProps {
  onFileDrop: (filePath: string) => void;
  onBrowse: () => void;
}

const ACCEPTED_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'gif', 'wmv', 'flv'];

export function FrameExtractorDropZone({ onFileDrop, onBrowse }: FrameExtractorDropZoneProps) {
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
    if (ACCEPTED_EXTENSIONS.includes(ext)) {
      onFileDrop(file.path);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center justify-center gap-4 h-full min-h-[300px]
        border-2 border-dashed rounded-[12px] transition-colors duration-150 cursor-pointer
        ${isDragging ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover'}
      `}
      onClick={onBrowse}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isDragging ? 'text-accent-light' : 'text-text-dim'}
      >
        <rect x="6" y="10" width="36" height="28" rx="4" />
        <path d="M19 24L22 27L29 20" />
        <path d="M6 18H42" />
      </svg>

      <div className="flex flex-col items-center gap-1">
        <p className={`text-[13px] font-medium ${isDragging ? 'text-accent-light' : 'text-text-muted'}`}>
          {isDragging ? 'Drop video here' : 'Drop a video file here'}
        </p>
        <p className="text-[11px] text-text-dim">
          or click to browse
        </p>
      </div>

      <p className="text-[10px] text-text-dim">
        MP4, MOV, AVI, MKV, WebM, GIF
      </p>
    </div>
  );
}
