import { useEffect, useRef, useState } from 'react';

interface HiddenSegmentChipProps {
  // Cut-time fraction at which the chip sits, 0..1 along the track.
  positionFraction: number;
  // Source duration of the hidden range — shown in the tooltip / popover.
  sourceDuration: number;
  cutReason?: string;
  onRestore: () => void;
  onDelete: () => void;
}

function formatSeconds(s: number): string {
  if (s < 1) return `${(s * 1000).toFixed(0)}ms`;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}m ${r.toFixed(0)}s`;
}

const REASON_LABELS: Record<string, string> = {
  retake: 'Retake',
  silence: 'Silence',
  repeat: 'Repeat',
  manual: 'Manual cut',
};

export function HiddenSegmentChip({
  positionFraction,
  sourceDuration,
  cutReason,
  onRestore,
  onDelete,
}: HiddenSegmentChipProps) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!chipRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const label = cutReason ? REASON_LABELS[cutReason] ?? cutReason : 'Cut';

  return (
    <div
      ref={chipRef}
      className="absolute top-0 h-full z-10"
      style={{
        left: `${positionFraction * 100}%`,
        width: 8,
        marginLeft: -4,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full h-full rounded-[1px] cursor-pointer transition-opacity hover:opacity-100"
        style={{
          backgroundColor: 'var(--color-status-error, #ef4444)',
          opacity: 0.85,
          boxShadow: open ? '0 0 0 1px var(--color-accent)' : undefined,
        }}
        title={`${label} · ${formatSeconds(sourceDuration)} cut`}
      />
      {open && (
        <div
          className="absolute top-full mt-1 -translate-x-1/2 left-1/2 flex flex-col gap-1 p-2 rounded-[6px] shadow-lg z-30"
          style={{
            backgroundColor: 'var(--color-app-surface)',
            border: '0.5px solid var(--color-border)',
            minWidth: 140,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[10px]">
            <span
              className="font-medium"
              style={{ color: 'var(--color-status-error, #ef4444)' }}
            >
              {label}
            </span>
            <span className="text-text-dim font-mono">
              {formatSeconds(sourceDuration)}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
              setOpen(false);
            }}
            className="text-left text-[11px] px-2 py-1 rounded-[3px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
          >
            Restore
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setOpen(false);
            }}
            className="text-left text-[11px] px-2 py-1 rounded-[3px] text-text-muted hover:text-status-error hover:bg-app-hover transition-colors"
          >
            Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}
