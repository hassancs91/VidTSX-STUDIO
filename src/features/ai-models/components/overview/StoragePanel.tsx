import { Button } from '@shared/components';
import { useSettings } from '@renderer/hooks/useSettings';
import { useLibraryStorage } from '../../hooks/useLibraryStorage';
import { formatBytes } from '../../services/format-bytes';
import { LocalSectionPanel } from '../local/LocalSectionPanel';

function truncatePath(p: string, maxLen = 52): string {
  if (!p) return '(default)';
  if (p.length <= maxLen) return p;
  return `${p.slice(0, 18)}…${p.slice(-30)}`;
}

/**
 * Overview → Storage (docs/ai-models-redesign.md §3.1): the models folder
 * with Change / Open, then installed counts and sizes per category.
 */
export function StoragePanel() {
  const settings = useSettings();
  const storage = useLibraryStorage();
  const total = storage.rows?.reduce((n, r) => n + r.bytes, 0) ?? 0;

  return (
    <LocalSectionPanel id="storage" title="Storage">
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted">Models folder</div>
          <div className="truncate font-mono text-[12px] text-text-secondary" title={settings.aiModelsFolder}>
            {truncatePath(settings.aiModelsFolder)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => void settings.browseAiModelsFolder()} disabled={settings.loading}>
            Change
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void window.api.systemModelsFolderOpen()}>
            Open folder
          </Button>
        </div>
      </div>

      <div className="py-1">
        {(storage.rows ?? []).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-1.5" data-storage-row={row.id}>
            <span className="text-[12px] text-text-secondary">{row.label}</span>
            <span className="font-mono text-[12px] text-text-primary">
              {storage.loading ? '—' : `${row.count} · ${formatBytes(row.bytes)}`}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-1.5" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <span className="text-[11px] text-text-muted">Total</span>
          <span className="font-mono text-[12px] text-text-primary">{storage.loading ? '—' : formatBytes(total)}</span>
        </div>
      </div>
      <div className="px-3 pb-2 text-[10px] text-text-dim">
        Changing the folder does not move existing files. Whisper models stay in the app data folder.
      </div>
    </LocalSectionPanel>
  );
}
