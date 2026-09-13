import { Captions, FileSearch, FileVideo, Image as ImageIcon, Music, TriangleAlert } from 'lucide-react';
import type { StudioMediaAsset } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import { formatDuration } from '../services/format-time';
import { assetFileName } from '../services/asset-usage';

interface Props {
  asset: StudioMediaAsset;
  thumbnail: string | null;
  transcribeProgress: TranscribeProgress | null;
  proxyPercent: number | null;
  missing: boolean;
  onLocate: () => void;
  /** Grid tile (small pills, kind icon beside the duration) vs the list card. */
  compact: boolean;
}

function kindIcon(kind: StudioMediaAsset['kind']) {
  return kind === 'audio' ? Music : kind === 'image' ? ImageIcon : FileVideo;
}

/**
 * The 16:9 thumbnail of a media asset with its status overlaid: duration +
 * kind, transcribe / proxy progress, transcript ready, and the Missing +
 * Locate… state. Shared by the grid tile and the list card (feedback item 5).
 */
export function MediaThumbnail({ asset, thumbnail, transcribeProgress, proxyPercent, missing, onLocate, compact }: Props) {
  const KindIcon = kindIcon(asset.kind);
  const transcribing = asset.transcript?.status === 'generating';
  const proxyGenerating = asset.proxy?.status === 'generating';
  const hasDuration = asset.kind !== 'image' && asset.probe.duration > 0;
  const pill = `absolute rounded-[3px] bg-black/70 py-px ${compact ? 'px-[3px] text-[8px]' : 'px-1 text-[9px]'}`;
  const edge = compact ? '3px' : '4px';

  return (
    <div className="relative aspect-video bg-app-base flex items-center justify-center overflow-hidden">
      {thumbnail ? (
        <img src={thumbnail} alt={assetFileName(asset)} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <KindIcon size={compact ? 16 : 20} strokeWidth={1.25} className="text-text-ghost" />
      )}
      {(hasDuration || compact) && (
        <span
          data-kind-badge={asset.kind}
          className={`${pill} flex items-center gap-[2px] text-text-secondary`}
          style={{ bottom: edge, right: edge }}
        >
          {compact && <KindIcon size={8} strokeWidth={2} />}
          {hasDuration ? formatDuration(asset.probe.duration) : null}
        </span>
      )}
      {transcribing ? (
        <span className={`${pill} text-accent-light`} style={{ bottom: edge, left: edge }} title="Transcribing">
          {transcribeProgress ? `${transcribeProgress.percent}%` : '…'}
        </span>
      ) : proxyGenerating ? (
        <span
          data-proxy-badge={asset.id}
          title="Building the preview proxy: the original plays until it's ready"
          className={`${pill} text-accent-light`}
          style={{ bottom: edge, left: edge }}
        >
          {compact ? '' : 'Proxy '}
          {proxyPercent !== null ? `${Math.round(proxyPercent)}%` : '…'}
        </span>
      ) : compact && asset.transcript?.status === 'ready' ? (
        <span
          data-transcript-badge={asset.id}
          title="Transcript ready"
          className={`${pill} text-accent-light flex items-center`}
          style={{ bottom: edge, left: edge }}
        >
          <Captions size={9} strokeWidth={2} />
        </span>
      ) : null}
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
          <span className={`flex items-center gap-1 font-medium text-accent-red ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            <TriangleAlert size={compact ? 10 : 12} strokeWidth={1.75} />
            Missing
          </span>
          <button
            data-locate={asset.id}
            onClick={(e) => {
              e.stopPropagation();
              onLocate();
            }}
            title="Find the moved/renamed source file (verified by content hash)"
            className={`flex items-center gap-1 rounded-[5px] bg-app-surface text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors ${
              compact ? 'px-1 h-[16px] text-[9px]' : 'px-1.5 h-[20px] text-[10px]'
            }`}
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            <FileSearch size={compact ? 9 : 11} strokeWidth={1.75} />
            Locate…
          </button>
        </div>
      )}
    </div>
  );
}
