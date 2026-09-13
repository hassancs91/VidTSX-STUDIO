import type { MouseEvent } from 'react';
import { Clapperboard, Film } from 'lucide-react';
import type { StudioMediaAsset } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import { assetFileName, describeAssetUsage, isAssetUsed, type AssetUsage } from '../services/asset-usage';
import { MediaThumbnail } from './MediaThumbnail';
import { AssetHoverActions } from './AssetHoverActions';

export interface AssetViewProps {
  asset: StudioMediaAsset;
  thumbnail: string | null;
  selected: boolean;
  transcribeProgress: TranscribeProgress | null;
  proxyPercent: number | null;
  missing: boolean;
  usage: AssetUsage;
  onRemove: () => void;
  onAdd: () => void;
  onTranscribe: () => void;
  onSelect: () => void;
  onLocate: () => void;
  onContextMenu: (event: MouseEvent) => void;
}

export function assetTitle(asset: StudioMediaAsset, missing: boolean): string {
  return missing
    ? `${asset.path}\n\nSource file not found — use Locate… to reconnect it`
    : `${asset.path}\n\nClick to inspect · double-click to add to the timeline · right-click for actions`;
}

/**
 * The compact grid tile (video-10 feedback item 5): thumbnail with the status
 * overlaid small, one truncated name line, the usage count top-left, actions
 * on hover or right-click. Selected = the accent ring.
 */
export function MediaTile(props: AssetViewProps) {
  const { asset, thumbnail, selected, transcribeProgress, proxyPercent, missing, usage } = props;
  const used = isAssetUsed(usage);
  const fileName = assetFileName(asset);

  return (
    <div
      data-media-tile={asset.id}
      className="group relative min-w-0 rounded-[5px] overflow-hidden bg-app-surface"
      style={{
        border: missing ? '0.5px solid var(--color-accent-red, #e5484d)' : '0.5px solid var(--color-border)',
        boxShadow: selected ? '0 0 0 1.5px var(--color-accent)' : undefined,
      }}
      title={assetTitle(asset, missing)}
      onClick={props.onSelect}
      onDoubleClick={props.onAdd}
      onContextMenu={props.onContextMenu}
    >
      <MediaThumbnail
        asset={asset}
        thumbnail={thumbnail}
        transcribeProgress={transcribeProgress}
        proxyPercent={proxyPercent}
        missing={missing}
        onLocate={props.onLocate}
        compact
      />
      {used && (
        <span
          data-usage-badge={asset.id}
          title={describeAssetUsage(usage)}
          className="absolute top-[3px] left-[3px] flex items-center gap-[2px] px-[3px] py-px rounded-[3px] bg-black/70 text-[8px] font-medium text-accent-light"
        >
          {usage.clips > 0 ? <Film size={8} strokeWidth={2} /> : <Clapperboard size={8} strokeWidth={2} />}
          {usage.clips > 0 ? usage.clips : usage.shots}
        </span>
      )}
      <AssetHoverActions
        asset={asset}
        inUse={used}
        onAdd={props.onAdd}
        onTranscribe={props.onTranscribe}
        onRemove={props.onRemove}
        className="absolute top-[3px] right-[3px]"
      />
      <div className="px-1 py-[3px] text-[9px] leading-tight text-text-primary truncate">{fileName}</div>
    </div>
  );
}
