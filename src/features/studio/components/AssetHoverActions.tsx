import { Captions, Plus, X } from 'lucide-react';
import type { StudioMediaAsset } from '../types';
import { assetFileName } from '../services/asset-usage';

interface Props {
  asset: StudioMediaAsset;
  /** The asset is on the timeline, so Remove asks first (feedback item 6). */
  inUse: boolean;
  onAdd: () => void;
  onTranscribe: () => void;
  onRemove: () => void;
  className?: string;
}

const ICON_BUTTON =
  'flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 transition-opacity';

/**
 * Add / transcribe / remove on a media tile or card, shown on hover (the
 * transcribe button stays lit while a transcription runs). The titles are the
 * ones the CDP drivers select on; the right-click menu offers the same actions.
 */
export function AssetHoverActions({ asset, inUse, onAdd, onTranscribe, onRemove, className = '' }: Props) {
  const fileName = assetFileName(asset);
  const transcribable = asset.kind !== 'image' && asset.probe.hasAudio;
  const transcribing = asset.transcript?.status === 'generating';
  const ready = asset.transcript?.status === 'ready';

  return (
    <div className={`flex items-center gap-[3px] ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title="Add to the timeline"
        aria-label={`Add ${fileName} to the timeline`}
        className={`${ICON_BUTTON} text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100`}
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
              : ready
                ? 'Transcript ready — click to re-transcribe'
                : 'Transcribe (word timestamps for auto-cut and captions)'
          }
          aria-label={`Transcribe ${fileName}`}
          className={`${ICON_BUTTON} ${
            transcribing
              ? 'text-accent-light opacity-100 animate-pulse'
              : ready
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
        title={
          inUse
            ? 'Remove from project — asks first, the asset is on the timeline (file is not deleted)'
            : 'Remove from project (file is not deleted)'
        }
        className={`${ICON_BUTTON} text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100`}
      >
        <X size={11} strokeWidth={1.75} />
      </button>
    </div>
  );
}
