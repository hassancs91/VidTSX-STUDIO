import { useId, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Replace,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import type {
  Asset,
  AssetPlacement,
  DrawableAsset,
  ImageAsset,
  RevealMode,
  TextAlignment,
  TextAsset,
  TextDirection,
  TextRevealMode,
} from '../types';
import { DEFAULT_PLACEMENT, isDrawableAsset, isImageAsset, isTextAsset } from '../types';
import {
  BUNDLED_HANDWRITING_FONTS,
  DEFAULT_REVEAL_DURATION_MS,
  IS_HANDWRITING_DRAW_ENABLED,
  IS_VECTORIZE_ENABLED,
  findHandwritingFont,
  getDrawModeTextDurationMs,
  getTextAssetDurationMs,
} from '../services/whiteboard-service';
import { useTextGlyphPaths } from '../hooks/useTextGlyphPaths';

interface Props {
  asset: Asset;
  onUpdate: (
    patch: Partial<DrawableAsset> | Partial<ImageAsset> | Partial<TextAsset>
  ) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Replace the file backing an image asset; renders only when the selected
   *  asset is an image. */
  onReplaceImage?: (file: File) => Promise<void>;
  /** Phase 12 — open the vectorize modal for the selected image asset.
   *  Renders the Vectorize section when set + IS_VECTORIZE_ENABLED. */
  onVectorizeImage?: () => void;
  /** Phase 11.b — scene's `pxPerSec`, used to compute the draw-mode text
   *  duration hint from extracted glyph path lengths. */
  scenePxPerSec?: number;
}

const DEFAULT_STROKE_FALLBACK = '#1a1a1a';
const IMAGE_REVEAL_OPTIONS: RevealMode[] = ['wipe', 'stamp', 'fade'];
const TEXT_REVEAL_OPTIONS: TextRevealMode[] = ['type', 'wipe', 'stamp', 'fade'];
const TEXT_REVEAL_OPTIONS_WITH_DRAW: TextRevealMode[] = [
  'type',
  'wipe',
  'stamp',
  'fade',
  'draw',
];

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Inter (default)', value: 'Inter, system-ui, sans-serif' },
  { label: 'System UI', value: 'system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
];

const WEIGHT_OPTIONS: number[] = [100, 300, 400, 500, 600, 700, 900];

const TEXT_ALIGNMENTS: { value: TextAlignment; icon: typeof AlignLeft; label: string }[] = [
  { value: 'left', icon: AlignLeft, label: 'Align left' },
  { value: 'center', icon: AlignCenter, label: 'Align center' },
  { value: 'right', icon: AlignRight, label: 'Align right' },
];

const TEXT_DIRECTIONS: { value: TextDirection; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'ltr', label: 'LTR' },
  { value: 'rtl', label: 'RTL' },
];

const DEFAULT_TEXT_COLOR = '#1a1a1a';

function friendlyName(asset: Asset): string {
  if (isImageAsset(asset)) {
    return asset.name?.trim() || 'Image';
  }
  if (isTextAsset(asset)) {
    const firstLine = asset.text.split('\n')[0]?.trim() || 'Text';
    return firstLine.length > 30 ? `${firstLine.slice(0, 30)}…` : firstLine;
  }
  const baseId = asset.id.split(':')[0];
  const friendly = baseId.replace(/^lib-/, '').replace(/-/g, ' ');
  return friendly.charAt(0).toUpperCase() + friendly.slice(1);
}

export function AssetInspectorPanel({
  asset,
  onUpdate,
  onDelete,
  onClose,
  onReplaceImage,
  onVectorizeImage,
  scenePxPerSec,
}: Props) {
  const placement: AssetPlacement = asset.placement ?? DEFAULT_PLACEMENT;
  const labelId = useId();
  const name = useMemo(() => friendlyName(asset), [asset]);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const patchPlacement = (next: Partial<AssetPlacement>) => {
    onUpdate({ placement: { ...placement, ...next } });
  };

  const handleReplaceClick = () => {
    setReplaceError(null);
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onReplaceImage) return;
    setReplacing(true);
    try {
      await onReplaceImage(file);
    } catch (err) {
      setReplaceError(err instanceof Error ? err.message : 'Replace failed');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-app-surface">
      <div
        className="flex items-center justify-between px-3 h-[36px] shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] uppercase tracking-wider text-text-dim">Inspector</span>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-text-primary transition-colors"
          title="Close inspector"
        >
          <X size={12} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-3 py-3 flex flex-col gap-4">
        <div>
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Name</span>
          <div className="text-[13px] text-text-primary mt-0.5">{name}</div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Position</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-dim">X</span>
              <input
                type="number"
                value={Math.round(placement.x)}
                onChange={(e) => patchPlacement({ x: parseFloat(e.target.value) || 0 })}
                className="h-[26px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none tabular-nums"
                style={{ border: '0.5px solid var(--color-border)' }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-dim">Y</span>
              <input
                type="number"
                value={Math.round(placement.y)}
                onChange={(e) => patchPlacement({ y: parseFloat(e.target.value) || 0 })}
                className="h-[26px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none tabular-nums"
                style={{ border: '0.5px solid var(--color-border)' }}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-dim uppercase tracking-wider">Scale</span>
            <span className="text-[11px] text-text-secondary tabular-nums">
              {placement.scale.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={4}
            step={0.05}
            value={placement.scale}
            onChange={(e) => patchPlacement({ scale: parseFloat(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        {isDrawableAsset(asset) ? (
          renderDrawableControls(asset, onUpdate, labelId)
        ) : isImageAsset(asset) ? (
          renderImageControls(
            asset,
            onUpdate,
            handleReplaceClick,
            replacing,
            replaceError,
            replaceInputRef,
            handleReplaceFile,
            onReplaceImage !== undefined,
            onVectorizeImage
          )
        ) : (
          <TextControls
            asset={asset}
            onUpdate={onUpdate as (patch: Partial<TextAsset>) => void}
            labelId={labelId}
            scenePxPerSec={scenePxPerSec}
          />
        )}
      </div>

      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onDelete}
          className="w-full inline-flex items-center justify-center gap-1.5 h-[32px] text-[12px] text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          <Trash2 size={14} strokeWidth={1.75} />
          Delete asset
        </button>
      </div>
    </div>
  );
}

function renderDrawableControls(
  asset: DrawableAsset,
  onUpdate: (patch: Partial<DrawableAsset>) => void,
  labelId: string
) {
  const strokeColor = asset.strokeColor ?? DEFAULT_STROKE_FALLBACK;
  const strokeColorIsOverride = asset.strokeColor !== undefined;
  const strokeWidth = asset.strokeWidth ?? 2;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Stroke colour</span>
          {strokeColorIsOverride ? (
            <button
              onClick={() => onUpdate({ strokeColor: undefined })}
              className="text-[10px] text-text-dim hover:text-text-primary transition-colors"
              title="Clear override; use scene default"
            >
              Reset
            </button>
          ) : (
            <span className="text-[10px] text-text-dim">scene default</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => onUpdate({ strokeColor: e.target.value })}
            className="w-[28px] h-[28px] cursor-pointer rounded-md"
            style={{ border: '0.5px solid var(--color-border)', padding: 0 }}
            aria-labelledby={labelId}
          />
          <input
            type="text"
            value={strokeColor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onUpdate({ strokeColor: v });
            }}
            className="flex-1 h-[28px] px-2 text-[12px] font-mono text-text-primary bg-app-base rounded-md focus:outline-none uppercase"
            style={{ border: '0.5px solid var(--color-border)' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Stroke width</span>
          <span className="text-[11px] text-text-secondary tabular-nums">
            {strokeWidth.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={8}
          step={0.5}
          value={strokeWidth}
          onChange={(e) => onUpdate({ strokeWidth: parseFloat(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>
    </>
  );
}

function renderImageControls(
  asset: ImageAsset,
  onUpdate: (patch: Partial<ImageAsset>) => void,
  handleReplaceClick: () => void,
  replacing: boolean,
  replaceError: string | null,
  replaceInputRef: React.RefObject<HTMLInputElement | null>,
  handleReplaceFile: (e: React.ChangeEvent<HTMLInputElement>) => void,
  canReplace: boolean,
  onVectorize?: () => void
) {
  const opacity = asset.opacity ?? 1;
  const reveal = asset.revealMode;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Opacity</span>
          <span className="text-[11px] text-text-secondary tabular-nums">
            {opacity.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Animation</span>
        <div className="grid grid-cols-3 gap-1">
          {IMAGE_REVEAL_OPTIONS.map((mode) => {
            const active = reveal === mode;
            return (
              <button
                key={mode}
                onClick={() => onUpdate({ revealMode: mode })}
                className={`h-[28px] text-[11px] rounded-md transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
                }`}
                style={{
                  border: active
                    ? '0.5px solid transparent'
                    : '0.5px solid var(--color-border)',
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-text-dim tabular-nums">
          ≈ {DEFAULT_REVEAL_DURATION_MS[reveal]}ms
        </span>
      </div>

      {IS_VECTORIZE_ENABLED && onVectorize && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Vectorize</span>
          <button
            onClick={onVectorize}
            className="inline-flex items-center justify-center gap-1.5 h-[28px] text-[11px] rounded-md hover:bg-app-hover transition-colors"
            style={{ border: '0.5px solid var(--color-border)' }}
            title="Trace this image into a drawable SVG"
          >
            <Wand2 size={11} strokeWidth={1.75} />
            <span>Trace to SVG</span>
          </button>
        </div>
      )}

      {canReplace && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">File</span>
          <button
            onClick={handleReplaceClick}
            disabled={replacing}
            className="inline-flex items-center justify-center gap-1.5 h-[28px] text-[11px] rounded-md hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            <Replace size={11} strokeWidth={1.75} />
            <span>{replacing ? 'Replacing…' : 'Replace image'}</span>
          </button>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleReplaceFile}
            className="hidden"
          />
          {replaceError && (
            <div className="text-[10px] text-red-500 truncate" title={replaceError}>
              {replaceError}
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface TextControlsProps {
  asset: TextAsset;
  onUpdate: (patch: Partial<TextAsset>) => void;
  labelId: string;
  scenePxPerSec?: number;
}

function TextControls({ asset, onUpdate, labelId, scenePxPerSec }: TextControlsProps) {
  const opacity = asset.opacity ?? 1;
  const reveal = asset.revealMode;
  const colorIsOverride = asset.color !== DEFAULT_TEXT_COLOR;
  // Auto-grow textarea between 3..6 rows based on line count.
  const lineCount = asset.text.split('\n').length;
  const rows = Math.min(6, Math.max(3, lineCount));
  const fontSelectValue = asset.fontFamily;
  const matchedSystemFont = FONT_OPTIONS.find((opt) => opt.value === fontSelectValue);
  const matchedHandwriting = findHandwritingFont(fontSelectValue);
  const fontHasMatch = !!matchedSystemFont || !!matchedHandwriting;
  // Phase 11.b — when the asset's font is one of the bundled handwriting
  // families, the Animation grid grows to include `Draw`. Otherwise the
  // pre-Phase 11.b 4-mode grid is shown.
  const isHandwritingFont = !!matchedHandwriting;
  const drawEnabled = IS_HANDWRITING_DRAW_ENABLED && isHandwritingFont;
  const revealOptions = drawEnabled ? TEXT_REVEAL_OPTIONS_WITH_DRAW : TEXT_REVEAL_OPTIONS;
  const glyphState = useTextGlyphPaths(asset);
  // Auto-revert: dragging the font off a handwriting family while `'draw'`
  // is active would otherwise leave the asset stuck on a mode it can't render.
  // Issue an atomic patch that swaps font + revealMode together.
  const handleFontChange = (nextFamily: string) => {
    const nextIsHandwriting = !!findHandwritingFont(nextFamily);
    if (asset.revealMode === 'draw' && !nextIsHandwriting) {
      onUpdate({ fontFamily: nextFamily, revealMode: 'fade' });
    } else {
      onUpdate({ fontFamily: nextFamily });
    }
  };

  return (
    <>
      {/* Text content */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Text</span>
        <textarea
          value={asset.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={rows}
          className="w-full px-2 py-1.5 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none resize-none"
          style={{ border: '0.5px solid var(--color-border)' }}
        />
      </div>

      {/* Font */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Font</span>
        <select
          value={fontHasMatch ? fontSelectValue : ''}
          onChange={(e) => {
            if (e.target.value) handleFontChange(e.target.value);
          }}
          className="w-full h-[28px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {!fontHasMatch && (
            <option value="" disabled>
              Custom: {fontSelectValue}
            </option>
          )}
          <optgroup label="System">
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          {IS_HANDWRITING_DRAW_ENABLED && (
            <optgroup label="Handwriting">
              {BUNDLED_HANDWRITING_FONTS.map((f) => (
                <option key={f.id} value={f.cssFamily}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Size + Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Size</span>
          <input
            type="number"
            min={8}
            max={200}
            step={1}
            value={asset.fontSize}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n) && n >= 8 && n <= 200) onUpdate({ fontSize: n });
            }}
            className="w-full h-[28px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none tabular-nums"
            style={{ border: '0.5px solid var(--color-border)' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Weight</span>
          <select
            value={asset.fontWeight}
            onChange={(e) => onUpdate({ fontWeight: parseInt(e.target.value, 10) })}
            className="w-full h-[28px] px-2 text-[12px] text-text-primary bg-app-base rounded-md focus:outline-none tabular-nums"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            {WEIGHT_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alignment */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Alignment</span>
        <div className="grid grid-cols-3 gap-1">
          {TEXT_ALIGNMENTS.map(({ value, icon: Icon, label }) => {
            const active = asset.alignment === value;
            return (
              <button
                key={value}
                onClick={() => onUpdate({ alignment: value })}
                title={label}
                className={`h-[28px] inline-flex items-center justify-center rounded-md transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
                }`}
                style={{
                  border: active
                    ? '0.5px solid transparent'
                    : '0.5px solid var(--color-border)',
                }}
              >
                <Icon size={14} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Direction */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Direction</span>
        <div className="grid grid-cols-3 gap-1">
          {TEXT_DIRECTIONS.map(({ value, label }) => {
            const active = asset.direction === value;
            return (
              <button
                key={value}
                onClick={() => onUpdate({ direction: value })}
                className={`h-[28px] text-[11px] rounded-md transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
                }`}
                style={{
                  border: active
                    ? '0.5px solid transparent'
                    : '0.5px solid var(--color-border)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Colour</span>
          {colorIsOverride ? (
            <button
              onClick={() => onUpdate({ color: DEFAULT_TEXT_COLOR })}
              className="text-[10px] text-text-dim hover:text-text-primary transition-colors"
              title="Reset to default"
            >
              Reset
            </button>
          ) : (
            <span className="text-[10px] text-text-dim">default</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={asset.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-[28px] h-[28px] cursor-pointer rounded-md"
            style={{ border: '0.5px solid var(--color-border)', padding: 0 }}
            aria-labelledby={labelId}
          />
          <input
            type="text"
            value={asset.color}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#[0-9a-fA-F]{6}$/.test(v)) onUpdate({ color: v });
            }}
            className="flex-1 h-[28px] px-2 text-[12px] font-mono text-text-primary bg-app-base rounded-md focus:outline-none uppercase"
            style={{ border: '0.5px solid var(--color-border)' }}
          />
        </div>
      </div>

      {/* Animation */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">Animation</span>
        <div className={`grid gap-1 ${drawEnabled ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {revealOptions.map((mode) => {
            const active = reveal === mode;
            return (
              <button
                key={mode}
                onClick={() => onUpdate({ revealMode: mode })}
                className={`h-[28px] text-[11px] rounded-md transition-colors ${
                  active
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
                }`}
                style={{
                  border: active
                    ? '0.5px solid transparent'
                    : '0.5px solid var(--color-border)',
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-text-dim tabular-nums">
          {reveal === 'draw'
            ? glyphState.status === 'ready'
              ? `≈ ${getDrawModeTextDurationMs(glyphState.data.totalLengthPx, scenePxPerSec ?? 1)}ms`
              : glyphState.status === 'loading'
              ? 'Extracting glyphs…'
              : glyphState.status === 'error'
              ? glyphState.error
              : `≈ ${DEFAULT_REVEAL_DURATION_MS.fade}ms`
            : `≈ ${getTextAssetDurationMs(asset)}ms`}
        </span>
      </div>

      {/* Opacity */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-dim uppercase tracking-wider">Opacity</span>
          <span className="text-[11px] text-text-secondary tabular-nums">
            {opacity.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-accent"
        />
      </div>
    </>
  );
}
