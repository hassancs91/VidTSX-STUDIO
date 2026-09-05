import { useEffect, useState } from 'react';
import { Euler } from 'three';
import { GlbViewer } from '@shared/components/GlbViewer';
import type { LibraryIndexEntry } from '@shared/types/asset-library';
import type { AssetEntry } from '../types';
import { formatBytes } from '../services/asset-search';

/** TripoSR's axis convention (see 3D Studio's GlbViewer wrapper) — the library's only generator of GLBs. */
const TRIPOSR_TO_THREE = new Euler(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ');

interface AssetDetailsPanelProps {
  entry: AssetEntry;
  meta: LibraryIndexEntry | undefined;
  previewUrl: string | null;
  /** Module-server URL of a selected .glb (plan §5 step 6) — rendered in the shared viewer. */
  glbUrl?: string | null;
  onSaveDescription: (relPath: string, description: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Right-hand inspector for the selected asset — the manual-description
 * surface (ASSET_LIBRARY_DESIGN.md L2). Descriptions are what the Studio
 * agent reads when picking assets; editing is always available, with or
 * without an AI provider.
 */
export function AssetDetailsPanel({
  entry,
  meta,
  previewUrl,
  glbUrl = null,
  onSaveDescription,
  onClose,
}: AssetDetailsPanelProps) {
  const [draft, setDraft] = useState(meta?.description ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  useEffect(() => {
    setDraft(meta?.description ?? '');
    setStatus('idle');
  }, [entry.node.path, meta?.description]);

  const save = async () => {
    if (!meta || draft.trim() === (meta.description ?? '')) return;
    setStatus('saving');
    const ok = await onSaveDescription(meta.relPath, draft);
    setStatus(ok ? 'idle' : 'error');
  };

  return (
    <aside
      className="w-[260px] shrink-0 flex flex-col gap-3 p-3 overflow-y-auto"
      style={{ borderLeft: '0.5px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-text-primary truncate" title={entry.node.name}>
          {entry.node.name}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-1.5 rounded text-text-muted hover:text-text-primary hover:bg-app-hover"
          title="Close details"
        >
          ×
        </button>
      </div>

      {previewUrl && (
        <div className="w-full rounded bg-app-deep overflow-hidden">
          <img src={previewUrl} alt={entry.node.name} className="w-full object-contain" draggable={false} />
        </div>
      )}
      {glbUrl && (
        // Generated GLBs come from TripoSR (x-forward / z-up); imported ones render as authored.
        <GlbViewer
          key={glbUrl}
          url={glbUrl}
          autoRotate
          rotation={meta?.origin === 'generated' ? TRIPOSR_TO_THREE : undefined}
          className="w-full aspect-square rounded overflow-hidden"
        />
      )}

      <dl className="flex flex-col gap-1 text-[11px]">
        <Row label="Type" value={entry.category + (entry.ext ? ` (${entry.ext.replace('.', '')})` : '')} />
        {meta?.size !== undefined && <Row label="Size" value={formatBytes(meta.size)} />}
        {meta && <Row label="Origin" value={meta.origin} />}
        {meta && <Row label="Added" value={new Date(meta.addedAt).toLocaleDateString()} />}
        {meta && <Row label="Path" value={meta.relPath} />}
      </dl>

      {meta ? (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-text-secondary" htmlFor="asset-description">
            Description
          </label>
          <textarea
            id="asset-description"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save();
            }}
            rows={4}
            placeholder='e.g. "primary logo, white on transparent, for dark backgrounds"'
            className="px-2 py-1.5 rounded bg-app-surface text-text-primary text-[12px] resize-y focus:outline-none"
            style={{ border: '0.5px solid var(--color-border-input)' }}
          />
          <div className="text-[10px] text-text-dim">
            {status === 'saving' && 'Saving…'}
            {status === 'error' && <span className="text-accent-red">Save failed — try again.</span>}
            {status === 'idle' &&
              'The Studio agent reads this when picking assets — specific beats generic.'}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-text-muted">
          Not indexed yet — hit Refresh to scan the library.
        </div>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[48px] shrink-0 text-text-dim">{label}</dt>
      <dd className="text-text-secondary break-all">{value}</dd>
    </div>
  );
}
