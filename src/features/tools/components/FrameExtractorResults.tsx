import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExtractedFrame } from '../types';

interface FrameExtractorResultsProps {
  frames: ExtractedFrame[];
  onSaveAll: () => void;
  onSaveFrame: (frame: ExtractedFrame) => void;
  onNewExtraction: () => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function FrameThumbnail({
  frame,
  onSave,
}: {
  frame: ExtractedFrame;
  onSave: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          window.api
            .fileReadBinary({ path: frame.filePath })
            .then((result) => {
              if (result.data) {
                const ext = frame.fileName.endsWith('.jpg') ? 'jpeg' : 'png';
                setSrc(`data:image/${ext};base64,${result.data}`);
              }
            })
            .catch(() => {});
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, [frame.filePath, frame.fileName]);

  return (
    <div
      ref={elRef}
      className="relative group rounded-[6px] overflow-hidden bg-app-base"
      style={{ border: '0.5px solid var(--color-border)', aspectRatio: '16/9' }}
    >
      {src ? (
        <img
          src={src}
          alt={`Frame ${frame.index + 1}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-text-dim border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[4px] bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2V8.5" />
            <path d="M3 6.5L6 9.5L9 6.5" />
            <path d="M2 10.5H10" />
          </svg>
          Save
        </button>
      </div>

      {/* Frame info */}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-[9px] text-white/80 font-mono">
          #{frame.index + 1} &middot; {formatTimestamp(frame.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function FrameExtractorResults({
  frames,
  onSaveAll,
  onSaveFrame,
  onNewExtraction,
}: FrameExtractorResultsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Action Bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[12px] text-text-secondary font-medium">
          {frames.length.toLocaleString()} frames extracted
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewExtraction}
            className="px-3 py-1.5 rounded-[5px] text-[11px] text-text-muted hover:text-text-primary bg-app-base hover:bg-app-hover transition-colors"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            New Extraction
          </button>
          <button
            onClick={onSaveAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[11px] text-white bg-accent hover:brightness-110 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2V8.5" />
              <path d="M3 6.5L6 9.5L9 6.5" />
              <path d="M2 10.5H10" />
            </svg>
            Save All as ZIP
          </button>
        </div>
      </div>

      {/* Frame Grid */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {frames.map((frame) => (
            <FrameThumbnail
              key={frame.index}
              frame={frame}
              onSave={() => onSaveFrame(frame)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
