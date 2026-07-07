import { useEffect, useMemo, useRef, useState } from 'react';
import type { DrawableAsset, UserSvgAsset } from '../types';
import { AssetPreview } from './AssetPreview';
import { useVectorize } from '../hooks/useVectorize';

interface Props {
  /** Source raster bytes (PNG/JPG/WebP). */
  bytes: Uint8Array;
  /** A renderable URL for the source preview (typically `vidtsx-image://{id}`). */
  sourceSrc: string;
  /** Display name for the source. Used to derive the saved SVG's name. */
  sourceName: string;
  /** Originating raster row id; copied onto the saved `UserSvgAsset`. */
  sourceImageId?: string;
  /** Persist the result. Returns the new entry so the caller can switch to it. */
  onSave: (input: {
    paths: string[];
    viewBox: string;
    name: string;
    sourceImageId?: string;
  }) => Promise<UserSvgAsset>;
  onClose: () => void;
}

const PREVIEW_SIZE = 240;
const DEBOUNCE_MS = 200;

function suggestSavedName(sourceName: string): string {
  const stem = sourceName.replace(/\.[^.]+$/, '').trim();
  const base = stem || 'Vectorized';
  return `${base} (vectorized)`;
}

export function VectorizeModal({ bytes, sourceSrc, sourceName, sourceImageId, onSave, onClose }: Props) {
  const [threshold, setThreshold] = useState(6);
  const [filterSpeckle, setFilterSpeckle] = useState(8);
  const [savedName, setSavedName] = useState(() => suggestSavedName(sourceName));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { status, result, error, vectorize } = useVectorize();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced re-trace on threshold or speckle change. Initial trace also fires
  // through this effect so the modal shows a result on first paint.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      vectorize(bytes, { mode: 'binary', threshold, filterSpeckle });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [bytes, threshold, filterSpeckle, vectorize]);

  // Build a throwaway DrawableAsset so we can reuse AssetPreview as the
  // vectorized-side renderer without inventing a parallel SVG component.
  const previewAsset = useMemo<DrawableAsset | null>(() => {
    if (!result) return null;
    return {
      id: 'vectorize-preview',
      paths: result.paths,
      viewBox: result.viewBox,
      revealMode: 'draw',
    };
  }, [result]);

  const canSave = status === 'ready' && !!result && !saving && savedName.trim().length > 0;

  const handleSave = async () => {
    if (!result) return;
    setSaveError(null);
    setSaving(true);
    try {
      await onSave({
        paths: result.paths,
        viewBox: result.viewBox,
        name: savedName.trim(),
        sourceImageId,
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-app-surface rounded-lg shadow-xl flex flex-col"
        style={{ border: '0.5px solid var(--color-border)', width: 640 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div
          className="px-4 h-[40px] flex items-center"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <h3 className="text-[13px] font-medium text-text-primary">Vectorize image</h3>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-text-dim uppercase tracking-wider">Source</span>
              <div
                className="bg-app-base rounded-md flex items-center justify-center overflow-hidden"
                style={{ border: '0.5px solid var(--color-border)', height: PREVIEW_SIZE }}
              >
                <img
                  src={sourceSrc}
                  alt={sourceName}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-text-dim uppercase tracking-wider">Vectorized</span>
              <div
                className="bg-app-base rounded-md flex items-center justify-center overflow-hidden"
                style={{ border: '0.5px solid var(--color-border)', height: PREVIEW_SIZE }}
              >
                {status === 'tracing' && (
                  <span className="text-[11px] text-text-dim">Tracing…</span>
                )}
                {status === 'error' && (
                  <span className="text-[11px] text-red-500 px-3 text-center" title={error}>
                    {error}
                  </span>
                )}
                {status === 'ready' && previewAsset && (
                  <AssetPreview asset={previewAsset} size={PREVIEW_SIZE - 16} />
                )}
                {status === 'idle' && (
                  <span className="text-[11px] text-text-dim">Preparing…</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-dim uppercase tracking-wider">
                Threshold
              </span>
              <span className="text-[11px] text-text-secondary tabular-nums">{threshold}</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              className="w-full accent-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-dim uppercase tracking-wider">
                Filter speckle
              </span>
              <span className="text-[11px] text-text-secondary tabular-nums">{filterSpeckle}</span>
            </div>
            <input
              type="range"
              min={1}
              max={32}
              step={1}
              value={filterSpeckle}
              onChange={(e) => setFilterSpeckle(parseInt(e.target.value, 10))}
              className="w-full accent-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-dim uppercase tracking-wider">Save as</span>
            <input
              type="text"
              value={savedName}
              onChange={(e) => setSavedName(e.target.value)}
              className="h-[28px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none"
              style={{ border: '0.5px solid var(--color-border)' }}
            />
          </div>

          {saveError && (
            <div className="text-[10px] text-red-500" title={saveError}>
              {saveError}
            </div>
          )}
        </div>

        <div
          className="px-4 py-3 flex justify-end gap-2"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <button
            onClick={onClose}
            className="h-[28px] px-3 text-[11px] text-text-secondary hover:text-text-primary rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="h-[28px] px-3 text-[11px] bg-accent text-white rounded-md hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save to My SVGs'}
          </button>
        </div>
      </div>
    </div>
  );
}
