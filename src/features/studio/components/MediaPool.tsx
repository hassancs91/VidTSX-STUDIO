import { useEffect, useState, type MouseEvent } from 'react';
import { FileVideo, Import } from 'lucide-react';
import type { StudioMediaAsset } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { assetFileName, describeAssetUsage, isAssetUsed, type AssetUsage } from '../services/asset-usage';
import { RemoveConfirmCard } from './RemoveConfirmCard';
import { MediaTile } from './MediaTile';
import { AssetCard } from './AssetCard';
import { DensityToggle, POOL_DENSITIES } from './DensityToggle';
import { FloatingMenu, type FloatingMenuItem } from './timeline/FloatingMenu';

interface Props {
  assets: StudioMediaAsset[];
  onImport: () => void;
  onRemove: (assetId: string) => void;
  /** Where the asset is used (item 6): the badge, and the confirm before a remove. */
  getAssetUsage: (assetId: string) => AssetUsage;
  onAddToTimeline: (asset: StudioMediaAsset) => void;
  onTranscribe: (asset: StudioMediaAsset) => void;
  onSelect: (assetId: string) => void;
  selectedAssetId: string | null;
  importing: boolean;
  loadThumbnail: (assetId: string, relPath: string) => Promise<void>;
  getThumbnail: (assetId: string) => string | null;
  getTranscribeProgress: (assetId: string) => TranscribeProgress | null;
  /** Proxy transcode percent while generating (bar + badge on the tile). */
  getProxyPercent: (assetId: string) => number | null;
  /** Source files gone from disk (Slice F) — badge + Locate… on their tiles. */
  missingAssetIds: ReadonlySet<string>;
  onLocate: (asset: StudioMediaAsset) => void;
}

/**
 * The Media tab of the left pane (video-10 feedback item 5): imported files
 * as a responsive grid of small tiles (or the roomy list cards), actions on
 * hover or right-click, the in-use confirm in place of the tile (item 6).
 */
export function MediaPool({
  assets,
  onImport,
  onRemove,
  getAssetUsage,
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

  const [density, setDensity] = useStoredChoice('studio.media.density', POOL_DENSITIES, 'grid');
  // The tile whose X was clicked while its asset is still on the timeline —
  // the confirm card takes the tile's place until Remove or Cancel.
  const [confirmAssetId, setConfirmAssetId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ asset: StudioMediaAsset; x: number; y: number } | null>(null);

  const requestRemove = (asset: StudioMediaAsset) => {
    if (isAssetUsed(getAssetUsage(asset.id))) setConfirmAssetId(asset.id);
    else onRemove(asset.id);
  };

  const openMenu = (asset: StudioMediaAsset, event: MouseEvent) => {
    event.preventDefault();
    onSelect(asset.id);
    setMenu({ asset, x: event.clientX, y: event.clientY });
  };

  const menuItems = (asset: StudioMediaAsset): FloatingMenuItem[] => {
    const transcribable = asset.kind !== 'image' && asset.probe.hasAudio;
    return [
      { id: 'add', label: 'Add to timeline' },
      ...(transcribable
        ? [{
            id: 'transcribe',
            label: asset.transcript?.status === 'ready' ? 'Re-transcribe' : 'Transcribe',
            disabled: asset.transcript?.status === 'generating',
          }]
        : []),
      ...(missingAssetIds.has(asset.id) ? [{ id: 'locate', label: 'Locate…' }] : []),
      { id: 'remove', label: 'Remove from project', danger: true },
    ];
  };

  const pickMenu = (asset: StudioMediaAsset, id: string) => {
    if (id === 'add') onAddToTimeline(asset);
    else if (id === 'transcribe') onTranscribe(asset);
    else if (id === 'locate') onLocate(asset);
    else if (id === 'remove') requestRemove(asset);
  };

  return (
    <div className="flex flex-col h-full bg-app-deep" data-media-pool data-density={density}>
      <div
        className="flex items-center justify-between h-[28px] px-2 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <DensityToggle value={density} onChange={setDensity} />
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
          <div className="flex flex-col items-center gap-2 text-center pt-6 pb-4 px-3">
            <FileVideo size={26} strokeWidth={1.25} className="text-text-ghost" />
            <div className="text-[11px] text-text-dim">Import video, audio, or images to get started.</div>
          </div>
        ) : (
          <div
            className={
              density === 'grid'
                ? 'grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(88px,1fr))]'
                : 'flex flex-col gap-2'
            }
          >
            {assets.map((asset) => {
              if (confirmAssetId === asset.id) {
                return (
                  <div key={asset.id} className="col-span-full">
                    <RemoveConfirmCard
                      testId={asset.id}
                      name={assetFileName(asset)}
                      usage={describeAssetUsage(getAssetUsage(asset.id))}
                      onConfirm={() => {
                        setConfirmAssetId(null);
                        onRemove(asset.id);
                      }}
                      onCancel={() => setConfirmAssetId(null)}
                    />
                  </div>
                );
              }
              const View = density === 'grid' ? MediaTile : AssetCard;
              return (
                <View
                  key={asset.id}
                  asset={asset}
                  thumbnail={getThumbnail(asset.id)}
                  selected={asset.id === selectedAssetId}
                  transcribeProgress={getTranscribeProgress(asset.id)}
                  proxyPercent={getProxyPercent(asset.id)}
                  missing={missingAssetIds.has(asset.id)}
                  usage={getAssetUsage(asset.id)}
                  onRemove={() => requestRemove(asset)}
                  onAdd={() => onAddToTimeline(asset)}
                  onTranscribe={() => onTranscribe(asset)}
                  onSelect={() => onSelect(asset.id)}
                  onLocate={() => onLocate(asset)}
                  onContextMenu={(event) => openMenu(asset, event)}
                />
              );
            })}
          </div>
        )}
      </div>

      {menu && (
        <FloatingMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.asset)}
          onPick={(id) => pickMenu(menu.asset, id)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
