import type { ReactNode } from 'react';
import { Button, Panel } from '@shared/components';

function truncatePath(p: string, maxLen = 46): string {
  if (!p) return '(no folder)';
  if (p.length <= maxLen) return p;
  return `${p.slice(0, 16)}…${p.slice(-26)}`;
}

interface LocalModelStatusStripProps {
  /** The section's runtime chip (LocalRuntimeChip or a wrapper around it). */
  runtime: ReactNode;
  /** Models folder path; omit for categories without a folder of their own. */
  folder?: string;
  onChangeFolder?: () => void;
  onOpenFolder?: () => void;
  onRescan?: () => void;
  onImport?: () => void;
  /** One quiet line under the strip (Audio: where cloud transcription lives). */
  note?: ReactNode;
}

/**
 * The status strip at the top of every local-model section
 * (docs/ai-models-redesign.md §3.3): runtime chip on the left, the models
 * folder and its actions on the right, wrapping on narrow windows.
 */
export function LocalModelStatusStrip({
  runtime,
  folder,
  onChangeFolder,
  onOpenFolder,
  onRescan,
  onImport,
  note,
}: LocalModelStatusStripProps) {
  const hasActions = Boolean(onChangeFolder || onOpenFolder || onRescan || onImport);

  return (
    <Panel className="mb-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2" data-local-strip>
        {runtime}
        {(folder !== undefined || hasActions) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            {folder !== undefined && (
              <div className="min-w-0">
                <div className="text-[11px] text-text-muted">Models folder</div>
                <div className="truncate font-mono text-[12px] text-text-secondary" title={folder}>
                  {truncatePath(folder)}
                </div>
              </div>
            )}
            {hasActions && (
              <div className="flex shrink-0 items-center gap-1.5">
                {onChangeFolder && <Button variant="secondary" size="sm" onClick={onChangeFolder}>Change</Button>}
                {onOpenFolder && <Button variant="secondary" size="sm" onClick={onOpenFolder}>Open folder</Button>}
                {onRescan && <Button variant="secondary" size="sm" onClick={onRescan}>Rescan</Button>}
                {onImport && <Button variant="primary" size="sm" onClick={onImport}>Import…</Button>}
              </div>
            )}
          </div>
        )}
      </div>
      {note && <div className="mt-2 text-[10px] text-text-dim">{note}</div>}
    </Panel>
  );
}
