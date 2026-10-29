import { Button } from '@shared/components';
import { effectiveModeLabel, modelSizeLabel, vectorStateLabel } from '@shared/library-search-text';
import type { LibrarySearchChoice } from '@shared/types/library-search';
import { useLibrarySearchSettings } from '../../../hooks/useLibrarySearchSettings';

/** The ladder (design §4). Auto is the default (unset); the rerank rung is only ever an explicit choice (LS-r7). */
const CHOICES: { value: LibrarySearchChoice; label: string }[] = [
  { value: 'auto', label: 'Auto (default) — Smart once the model is here' },
  { value: 'basic', label: 'Basic — words' },
  { value: 'smart', label: 'Smart — words + meaning' },
  { value: 'smart-rerank', label: 'Smart + AI rerank — your AI provider orders the top 20' },
];

/**
 * "Library search" — Settings › General (LIBRARY_SEARCH_DESIGN.md §4). Self-contained like
 * ProxyGpuEncoderRow: the choice, the model's size, a Download button (nothing downloads
 * without the click) with its progress, and the vector state.
 */
export function LibrarySearchRow() {
  const { status, downloadPercent, error, setChoice, download } = useLibrarySearchSettings();
  const size = status ? modelSizeLabel(status.modelBytes) : '…';
  const downloading = downloadPercent !== null && status?.modelDownloaded !== true;
  const percent = Math.round(downloadPercent ?? 0);

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border" data-library-search-row>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-text-muted mb-1">Library search</div>
          <div className="text-[10px] text-text-dim">
            How the Assets search box and the assistant find library items. Basic matches words; Smart also
            matches meaning with a small local model ({status?.modelId ?? 'multilingual-e5-small'}, {size}),
            downloaded only when you click. Smart + AI rerank also lets your default AI provider reorder the Assets
            search's top 20 once you stop typing (one logged call per search); the assistant never reranks.
          </div>
          {status && (
            <div className="text-[10px] text-text-secondary mt-1" data-library-search-state>
              Now: {effectiveModeLabel(status)} · vectors {vectorStateLabel(status.vectors)}
            </div>
          )}
          {downloading && (
            <div className="mt-2 h-[4px] w-full rounded-[2px] bg-app-hover overflow-hidden" data-library-search-progress>
              <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
          )}
          {error && (
            <div className="text-[10px] text-accent-red mt-1" data-library-search-error>
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && !status.modelDownloaded && (
            <Button variant="secondary" onClick={() => void download()} disabled={downloading} data-library-search-download>
              {downloading ? `Downloading… ${percent}%` : `Download (${size})`}
            </Button>
          )}
          <select
            className="bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
            value={status?.choice ?? 'auto'}
            onChange={(e) => void setChoice(e.target.value as LibrarySearchChoice)}
            disabled={!status}
            data-library-search-choice
          >
            {CHOICES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
