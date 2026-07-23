import { useState } from 'react';
import type { ProfileModelIpc } from '@shared/ipc/types';
import type { ModelDownloadStatus } from '../hooks/useImageLibrary';
import { DownloadCell } from './DownloadCell';
import { FitBadge } from './FitBadge';

function familyLabel(family: string): string {
  const map: Record<string, string> = { sd15: 'SD 1.5', sdxl: 'SDXL', sd3: 'SD 3.x', flux1: 'FLUX.1', flux2: 'FLUX.2', wan21: 'Wan 2.1', wan22: 'Wan 2.2', ltx: 'LTX-2.3', lingbot: 'LingBot' };
  return map[family] ?? family.toUpperCase();
}

interface ProfileCatalogListProps {
  profiles: ProfileModelIpc[];
  downloads: Record<string, ModelDownloadStatus>;
  onDownload: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenExternal: (url: string) => void;
}

export function ProfileCatalogList({
  profiles,
  downloads,
  onDownload,
  onPause,
  onResume,
  onCancel,
  onOpenExternal,
}: ProfileCatalogListProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = query
    ? profiles.filter((p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query) || p.family.toLowerCase().includes(query))
    : profiles;

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      <div className="px-3 h-[32px] flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="text-[10px] font-medium text-text-dim uppercase tracking-wider">Model library</span>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-app-base border border-border rounded px-2 py-0.5 text-[11px] text-text-secondary placeholder:text-text-dim outline-none focus:border-accent w-[150px]"
        />
      </div>

      <div className="px-3 py-1.5 text-[10px] text-text-dim border-b border-border">
        One-click download — the model and any files it needs are fetched together. Or use Import.
      </div>

      {filtered.length === 0 ? (
        <div className="p-4 text-[12px] text-text-muted text-center">{query ? 'No matches' : 'All catalog models are installed'}</div>
      ) : (
        filtered.map((p) => (
          <div key={p.id} className="px-3 py-2 border-b border-border last:border-b-0 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-text-secondary truncate">{p.name}</span>
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">{familyLabel(p.family)}</span>
                <FitBadge fit={p.fit} />
              </div>
              <div className="text-[9px] text-text-dim">{p.sizeLabel}</div>
            </div>

            {downloads[p.id] ? (
              <DownloadCell
                status={downloads[p.id]}
                onPause={() => onPause(p.id)}
                onResume={() => onResume(p.id)}
                onCancel={() => onCancel(p.id)}
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => onOpenExternal(p.sourceUrl)} className="px-2 h-[24px] rounded text-[10px] font-medium text-text-muted hover:text-accent-light hover:bg-app-hover" title={p.sourceUrl}>
                  Get ↗
                </button>
                {p.hasDownload && (
                  <button onClick={() => onDownload(p.id)} className="px-2 h-[24px] rounded text-[10px] font-medium text-accent-light hover:bg-app-hover">
                    Download
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
