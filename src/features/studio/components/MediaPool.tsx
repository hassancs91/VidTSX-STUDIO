import { useEffect } from 'react';
import { FileVideo, Import, Music, Image as ImageIcon, X } from 'lucide-react';
import type { StudioMediaAsset } from '../types';
import { useStudioThumbnails } from '../hooks/useStudioThumbnails';
import { formatDuration } from '../services/format-time';

interface Props {
  projectId: string;
  assets: StudioMediaAsset[];
  onImport: () => void;
  onRemove: (assetId: string) => void;
  importing: boolean;
}

export function MediaPool({ projectId, assets, onImport, onRemove, importing }: Props) {
  const { loadThumbnail, getThumbnail } = useStudioThumbnails(projectId);

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
                onRemove={() => onRemove(asset.id)}
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
  onRemove,
}: {
  asset: StudioMediaAsset;
  thumbnail: string | null;
  onRemove: () => void;
}) {
  const fileName = asset.path.split(/[\\/]/).pop() ?? asset.path;
  const KindIcon = asset.kind === 'audio' ? Music : asset.kind === 'image' ? ImageIcon : FileVideo;

  return (
    <div
      className="group relative rounded-[6px] overflow-hidden bg-app-surface"
      style={{ border: '0.5px solid var(--color-border)' }}
      title={asset.path}
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
        onClick={onRemove}
        title="Remove from project (file is not deleted)"
        className="absolute top-1 right-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={11} strokeWidth={1.75} />
      </button>
    </div>
  );
}
