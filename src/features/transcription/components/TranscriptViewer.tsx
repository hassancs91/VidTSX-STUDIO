import { useState, useCallback } from 'react';
import { Button } from '@shared/components';
import type { TranscriptResult, ExportFormat } from '../types';

interface TranscriptViewerProps {
  result: TranscriptResult;
  onExport: (format: ExportFormat) => Promise<{ success: boolean; filePath?: string }>;
  onCopy: () => Promise<boolean>;
}

// Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format duration for display
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

export function TranscriptViewer({ result, onExport, onCopy }: TranscriptViewerProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [savedFormat, setSavedFormat] = useState<ExportFormat | null>(null);

  const handleCopy = useCallback(async () => {
    const success = await onCopy();
    if (success) {
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [onCopy]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const result = await onExport(format);
      if (result.success) {
        setSavedFormat(format);
        setTimeout(() => setSavedFormat(null), 2000);
      }
    },
    [onExport]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header with stats */}
      <div
        className="px-4 py-3 bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          <span>
            Language: <span className="text-text-secondary">{result.language}</span>
          </span>
          <span>
            Duration: <span className="text-text-secondary">{formatDuration(result.duration)}</span>
          </span>
          <span>
            Segments: <span className="text-text-secondary">{result.segments.length}</span>
          </span>
        </div>
      </div>

      {/* Transcript content */}
      <div className="flex-1 overflow-auto p-4 bg-app-base">
        <div className="max-w-[700px]">
          {result.segments.map((segment, index) => (
            <div
              key={segment.id ?? index}
              className="flex gap-3 py-2 last:border-b-0 hover:bg-app-hover transition-colors rounded px-2 -mx-2"
              style={{ borderBottom: '0.5px solid rgba(42, 42, 46, 0.5)' }}
            >
              <span className="text-[10px] text-text-dim font-mono w-[60px] shrink-0 pt-0.5">
                {formatTime(segment.start)}
              </span>
              <span className="text-[12px] text-text-secondary leading-relaxed">
                {segment.speaker && (
                  <span className="text-accent font-medium mr-1.5">{segment.speaker}:</span>
                )}
                {segment.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Export toolbar */}
      <div
        className="px-4 py-3 bg-app-surface flex items-center gap-2"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        <Button variant="secondary" onClick={handleCopy}>
          {copyFeedback || 'Copy text'}
        </Button>
        <div className="w-px h-4 bg-border mx-1" style={{ backgroundColor: 'var(--color-border)' }} />
        <Button variant="secondary" onClick={() => handleExport('srt')}>
          {savedFormat === 'srt' ? 'Saved!' : 'Save SRT'}
        </Button>
        <Button variant="secondary" onClick={() => handleExport('vtt')}>
          {savedFormat === 'vtt' ? 'Saved!' : 'Save VTT'}
        </Button>
        <Button variant="secondary" onClick={() => handleExport('txt')}>
          {savedFormat === 'txt' ? 'Saved!' : 'Save TXT'}
        </Button>
        <Button variant="secondary" onClick={() => handleExport('json')}>
          {savedFormat === 'json' ? 'Saved!' : 'Save JSON'}
        </Button>
      </div>
    </div>
  );
}
