import { assetFileName, describeAssetUsage, isAssetUsed } from '../services/asset-usage';
import { MediaThumbnail } from './MediaThumbnail';
import { AssetHoverActions } from './AssetHoverActions';
import { assetTitle, type AssetViewProps } from './MediaTile';

/**
 * The roomy list card: full-width thumbnail, the whole file name, kind ·
 * size · fps. The pool's "list" density (feedback item 5) — for reading long
 * file names; the grid tile is the default.
 */
export function AssetCard(props: AssetViewProps) {
  const { asset, thumbnail, selected, transcribeProgress, proxyPercent, missing, usage } = props;
  const used = isAssetUsed(usage);

  return (
    <div
      data-media-card={asset.id}
      className="group relative rounded-[6px] overflow-hidden bg-app-surface"
      style={{
        border: missing
          ? '0.5px solid var(--color-accent-red, #e5484d)'
          : selected
            ? '0.5px solid var(--color-accent)'
            : '0.5px solid var(--color-border)',
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
        compact={false}
      />
      <div className="px-1.5 py-1">
        <div className="flex items-center gap-1">
          <div className="text-[10px] text-text-primary truncate flex-1 min-w-0">{assetFileName(asset)}</div>
          {used && (
            <span
              data-usage-badge={asset.id}
              title={describeAssetUsage(usage)}
              className="shrink-0 px-1 py-px rounded-[3px] bg-accent/15 text-[8px] font-medium text-accent-light"
            >
              {usage.clips > 0
                ? `${usage.clips} clip${usage.clips === 1 ? '' : 's'}`
                : `${usage.shots} shot${usage.shots === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <div className="text-[9px] text-text-muted">
          {asset.kind}
          {asset.probe.width && asset.probe.height ? ` · ${asset.probe.width}×${asset.probe.height}` : ''}
          {asset.probe.fps ? ` · ${asset.probe.fps} fps` : ''}
        </div>
      </div>
      <AssetHoverActions
        asset={asset}
        inUse={used}
        onAdd={props.onAdd}
        onTranscribe={props.onTranscribe}
        onRemove={props.onRemove}
        className="absolute top-1 right-1"
      />
    </div>
  );
}
