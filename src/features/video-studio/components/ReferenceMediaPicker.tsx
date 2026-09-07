import { useCallback } from 'react';

const FILTERS: Record<'video' | 'audio', { name: string; extensions: string[] }> = {
  video: { name: 'Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] },
  audio: { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] },
};

interface ReferenceMediaPickerProps {
  kind: 'video' | 'audio';
  label: string;
  /** How many of this kind the chosen model accepts; 0 hides the picker. */
  limit: number;
  /** The provider's own limit copy (size / combined duration). */
  hint?: string;
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}

function fileName(p: string): string {
  return p.split(/[\/]/).pop() ?? p;
}

/**
 * Reference clips and audio beds, chosen as local paths — the bytes never
 * enter the renderer. The engine gates them (frame sampling for video) and
 * the provider hosts them, so a path is the cheapest thing to hand over.
 */
export function ReferenceMediaPicker({
  kind,
  label,
  limit,
  hint,
  paths,
  onChange,
  disabled = false,
}: ReferenceMediaPickerProps) {
  const full = paths.length >= limit;

  const handleAdd = useCallback(async () => {
    const result = await window.api.dialogOpen({
      filters: [FILTERS[kind]],
      multiSelections: limit - paths.length > 1,
    });
    if (result.canceled || result.filePaths.length === 0) return;
    const merged = [...paths];
    for (const p of result.filePaths) {
      if (merged.length >= limit) break;
      if (!merged.includes(p)) merged.push(p);
    }
    onChange(merged);
  }, [kind, limit, paths, onChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || full) return;
      const dropped = Array.from(e.dataTransfer.files)
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => Boolean(p));
      if (dropped.length === 0) return;
      const merged = [...paths];
      for (const p of dropped) {
        if (merged.length >= limit) break;
        if (!merged.includes(p)) merged.push(p);
      }
      onChange(merged);
    },
    [disabled, full, limit, paths, onChange],
  );

  if (limit <= 0) return null;

  return (
    <div>
      <div className="text-[10px] text-text-dim mb-1">
        {label} ({paths.length}/{limit})
      </div>

      {paths.length > 0 && (
        <div className="flex flex-col gap-1 mb-1.5">
          {paths.map((p, i) => (
            <div
              key={p}
              className="flex items-center gap-1.5 bg-app-base border border-border rounded px-2 py-1"
            >
              <span className="text-[10px] text-text-dim shrink-0">
                @{kind === 'video' ? 'Video' : 'Audio'}
                {i + 1}
              </span>
              <span className="text-[10px] text-text-secondary truncate flex-1" title={p}>
                {fileName(p)}
              </span>
              <button
                type="button"
                className="text-[10px] text-text-dim hover:text-accent-red transition-colors"
                onClick={() => onChange(paths.filter((x) => x !== p))}
                disabled={disabled}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`flex flex-col items-center justify-center border border-dashed rounded-lg py-2 px-3 transition-colors ${
          full || disabled
            ? 'border-border opacity-40'
            : 'border-border cursor-pointer hover:border-text-dim hover:bg-app-base/50'
        }`}
        onClick={() => {
          if (!full && !disabled) void handleAdd();
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <span className="text-[10px] text-text-dim text-center">
          {full ? `Limit reached (${limit})` : `Drop or click to add ${kind} references`}
        </span>
        {hint && !full && <span className="text-[9px] text-text-dim/70 mt-0.5">{hint}</span>}
      </div>
    </div>
  );
}
