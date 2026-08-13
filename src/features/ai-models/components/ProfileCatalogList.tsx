import { useState } from 'react';
import { Panel, TextInput } from '@shared/components';
import type { ProfileModelIpc } from '@shared/ipc/types';
import type { ModelDownloadStatus } from '../hooks/useImageLibrary';
import { DownloadCell } from './DownloadCell';
import { FamilyBadge } from './FamilyBadge';
import { FitBadge } from './FitBadge';

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
    <Panel>
      <div className="px-3 h-[36px] flex items-center justify-between gap-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="text-[11px] font-medium text-text-muted">Available to download</span>
        <TextInput
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[160px]"
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
                <FamilyBadge family={p.family} />
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
    </Panel>
  );
}
