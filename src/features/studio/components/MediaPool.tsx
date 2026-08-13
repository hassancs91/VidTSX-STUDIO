import { useEffect } from 'react';
import {
  Captions,
  FileVideo,
  FileSearch,
  Import,
  Music,
  Image as ImageIcon,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { StudioMediaAsset } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import { formatDuration } from '../services/format-time';

interface Props {
  assets: StudioMediaAsset[];
  onImport: () => void;
  onRemove: (assetId: string) => void;
  onAddToTimeline: (asset: StudioMediaAsset) => void;
  onTranscribe: (asset: StudioMediaAsset) => void;
  onSelect: (assetId: string) => void;
  selectedAssetId: string | null;
  importing: boolean;
  loadThumbnail: (assetId: string, relPath: string) => Promise<void>;
  getThumbnail: (assetId: string) => string | null;
  getTranscribeProgress: (assetId: string) => TranscribeProgress | null;
  /** Proxy transcode percent while generating (bar + badge on the card). */
  getProxyPercent: (assetId: string) => number | null;
  /** Source files gone from disk (Slice F) — badge + Locate… on their cards. */
  missingAssetIds: ReadonlySet<string>;
  onLocate: (asset: StudioMediaAsset) => void;
}

export function MediaPool({
  assets,
  onImport,
  onRemove,
  onAddToTimeline,
  onTranscribe,
  onSelect,
  selectedAssetId,
  importing,
  loadThumbnail,
  getThumbnail,
  getTranscribeProgress,
  getProxyPercent,
  missingAssetIds,
  onLocate,
}: Props) {
  useEffect(() => {
    for (const asset of assets) {
      if (asset.thumbnail?.status === 'ready') {
        void loadThumbnail(asset.id, asset.thumbnail.path);
      }
    }
  }, [assets, loadThumbnail]);

  return (
    <div className="flex flex-col h-full bg-app-deep">
      <div
        className="flex items-center justify-between h-[32px] px-2.5 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-secondary">Media</span>
        <button
          onClick={onImport}
          disabled={importing}
          title="Import media files"
          className="flex items-center gap-1 px-1.5 h-[22px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          <Import size={12} strokeWidth={1.5} />
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center pt-10 px-3">
            <FileVideo size={26} strokeWidth={1.25} className="text-text-ghost" />
            <div className="text-[11px] text-text-dim">
              Import video, audio, or images to get started.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                thumbnail={getThumbnail(asset.id)}
                selected={asset.id === selectedAssetId}
                transcribeProgress={getTranscribeProgress(asset.id)}
                proxyPercent={getProxyPercent(asset.id)}
                missing={missingAssetIds.has(asset.id)}
                onRemove={() => onRemove(asset.id)}
                onAdd={() => onAddToTimeline(asset)}
                onTranscribe={() => onTranscribe(asset)}
                onSelect={() => onSelect(asset.id)}
                onLocate={() => onLocate(asset)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  thumbnail,
  selected,
  transcribeProgress,
  proxyPercent,
  missing,
  onRemove,
  onAdd,
  onTranscribe,
  onSelect,
  onLocate,
}: {
  asset: StudioMediaAsset;
  thumbnail: string | null;
  selected: boolean;
  transcribeProgress: TranscribeProgress | null;
  proxyPercent: number | null;
  missing: boolean;
  onRemove: () => void;
  onAdd: () => void;
  onTranscribe: () => void;
  onSelect: () => void;
  onLocate: () => void;
}) {
  const fileName = asset.path.split(/[\\/]/).pop() ?? asset.path;
  const KindIcon = asset.kind === 'audio' ? Music : asset.kind === 'image' ? ImageIcon : FileVideo;
  const transcribable = asset.kind !== 'image' && asset.probe.hasAudio;
  const transcribing = asset.transcript?.status === 'generating';
  const proxyGenerating = asset.proxy?.status === 'generating';

  return (
    <div
      className="group relative rounded-[6px] overflow-hidden bg-app-surface"
      style={{
        border: missing
          ? '0.5px solid var(--color-accent-red, #e5484d)'
          : selected
            ? '0.5px solid var(--color-accent)'
            : '0.5px solid var(--color-border)',
      }}
      title={
        missing
          ? `${asset.path}\n\nSource file not found — use Locate… to reconnect it`
          : `${asset.path}\n\nClick to inspect · double-click to add to the timeline`
      }
      onClick={onSelect}
      onDoubleClick={onAdd}
    >
      <div className="relative aspect-video bg-app-base flex items-center justify-center">
        {thumbnail ? (
          <img src={thumbnail} alt={fileName} className="w-full h-full object-cover" />
        ) : (
          <KindIcon size={20} strokeWidth={1.25} className="text-text-ghost" />
        )}
        {asset.kind !== 'image' && asset.probe.duration > 0 && (
          <span className="absolute bottom-1 right-1 px-1 py-px rounded-[3px] bg-black/70 text-[9px] text-text-secondary">
            {formatDuration(asset.probe.duration)}
          </span>
        )}
        {transcribing && (
          <span className="absolute bottom-1 left-1 px-1 py-px rounded-[3px] bg-black/70 text-[9px] text-accent-light">
            {transcribeProgress ? `${transcribeProgress.percent}%` : '…'}
          </span>
        )}
        {proxyGenerating && !transcribing && (
          <span
            data-proxy-badge={asset.id}
            title="Building the 720p preview proxy — the original plays until it's ready"
            className="absolute bottom-1 left-1 px-1 py-px rounded-[3px] bg-black/70 text-[9px] text-accent-light"
          >
            Proxy {proxyPercent !== null ? `${Math.round(proxyPercent)}%` : '…'}
          </span>
        )}
        {proxyGenerating && (
          <div
            data-proxy-progress={asset.id}
            className="absolute bottom-0 left-0 h-[2px] bg-accent transition-[width] duration-300"
            style={{ width: `${Math.max(2, Math.round(proxyPercent ?? 0))}%` }}
          />
        )}
        {missing && (
          <div
            data-missing-badge={asset.id}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55"
          >
            <span className="flex items-center gap-1 text-[10px] font-medium text-accent-red">
              <TriangleAlert size={12} strokeWidth={1.75} />
              Missing
            </span>
            <button
              data-locate={asset.id}
              onClick={(e) => {
                e.stopPropagation();
                onLocate();
              }}
              title="Find the moved/renamed source file (verified by content hash)"
              className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] bg-app-surface text-[10px] text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors"
              style={{ border: '0.5px solid var(--color-border-hover)' }}
            >
              <FileSearch size={11} strokeWidth={1.75} />
              Locate…
            </button>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1">
        <div className="text-[10px] text-text-primary truncate">{fileName}</div>
        <div className="text-[9px] text-text-muted">
          {asset.kind}
          {asset.probe.width && asset.probe.height ? ` · ${asset.probe.width}×${asset.probe.height}` : ''}
          {asset.probe.fps ? ` · ${asset.probe.fps} fps` : ''}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title="Add to the timeline"
        aria-label={`Add ${fileName} to the timeline`}
        className="absolute top-1 left-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Plus size={12} strokeWidth={2} />
      </button>
      {transcribable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!transcribing) onTranscribe();
          }}
          title={
            transcribing
              ? 'Transcribing…'
              : asset.transcript?.status === 'ready'
                ? 'Transcript ready — click to re-transcribe'
                : 'Transcribe (word timestamps for auto-cut and captions)'
          }
          aria-label={`Transcribe ${fileName}`}
          className={`absolute top-1 left-[23px] flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 transition-opacity ${
            transcribing
              ? 'text-accent-light opacity-100 animate-pulse'
              : asset.transcript?.status === 'ready'
                ? 'text-accent-light opacity-0 group-hover:opacity-100'
                : 'text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100'
          }`}
        >
          <Captions size={12} strokeWidth={1.75} />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove from project (file is not deleted)"
        className="absolute top-1 right-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={11} strokeWidth={1.75} />
      </button>
    </div>
  );
}
