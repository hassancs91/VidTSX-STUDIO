import { useState, useEffect, useCallback } from 'react';
import { Modal, Button } from '@shared/components';
import type { RenderCodec } from '@shared/ipc/types';

export interface RenderSettings {
  codec: RenderCodec;
  scale: number;
  fps: number;
  crf: number;
  muted: boolean;
  everyNthFrame: number;
  numberOfGifLoops: number | null;
}

interface RenderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRender: (settings: RenderSettings) => void;
  compositionConfig: { width: number; height: number; fps: number };
}

const FORMAT_OPTIONS = [
  { value: 'h264' as RenderCodec, label: 'MP4 (H.264)' },
  { value: 'h265' as RenderCodec, label: 'MP4 (H.265)' },
  { value: 'vp9' as RenderCodec, label: 'WebM' },
  { value: 'gif' as RenderCodec, label: 'GIF' },
];

const QUALITY_OPTIONS = [
  { value: 'best', label: 'Best', hint: 'Largest file' },
  { value: 'high', label: 'High', hint: 'Recommended' },
  { value: 'medium', label: 'Medium', hint: 'Balanced' },
  { value: 'low', label: 'Low', hint: 'Smallest file' },
];

const SMOOTHNESS_OPTIONS = [
  { value: '1', label: 'Smooth \u2014 every frame' },
  { value: '2', label: 'Balanced \u2014 every 2nd frame' },
  { value: '3', label: 'Lighter \u2014 every 3rd frame' },
];

const LOOP_OPTIONS = [
  { value: 'forever', label: 'Loop forever' },
  { value: '1', label: 'Play once' },
  { value: '3', label: 'Loop 3 times' },
];

const FPS_PRESETS = [60, 30, 24, 15];

type ResolutionPreset = 'original' | '4k' | '1080p' | '720p' | '480p';

interface ResolutionOption {
  value: ResolutionPreset;
  label: string;
  width: number;
  height: number;
}

function makeEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function getResolutionPresets(
  compWidth: number,
  compHeight: number
): ResolutionOption[] {
  const aspectRatio = compWidth / compHeight;
  const isLandscape = compWidth >= compHeight;

  const presets: { value: ResolutionPreset; label: string; targetHeight: number }[] = [
    { value: '4k', label: '4K', targetHeight: 2160 },
    { value: '1080p', label: '1080p', targetHeight: 1080 },
    { value: '720p', label: '720p', targetHeight: 720 },
    { value: '480p', label: '480p', targetHeight: 480 },
  ];

  const options: ResolutionOption[] = [
    {
      value: 'original',
      label: `Original (${compWidth}\u00d7${compHeight})`,
      width: compWidth,
      height: compHeight,
    },
  ];

  for (const p of presets) {
    let width: number;
    let height: number;

    if (isLandscape) {
      height = p.targetHeight;
      width = makeEven(p.targetHeight * aspectRatio);
    } else {
      width = p.targetHeight;
      height = makeEven(p.targetHeight / aspectRatio);
    }

    // Skip presets larger than or equal to original
    if (isLandscape && height >= compHeight) continue;
    if (!isLandscape && width >= compWidth) continue;

    options.push({
      value: p.value,
      label: `${p.label} (${width}\u00d7${height})`,
      width,
      height,
    });
  }

  return options;
}

function getCrf(quality: string, codec: RenderCodec): number {
  if (codec === 'gif') return 0;

  const isVp = codec === 'vp8' || codec === 'vp9';

  switch (quality) {
    case 'best':
      return isVp ? 15 : 15;
    case 'high':
      return isVp ? 25 : 18;
    case 'medium':
      return isVp ? 33 : 23;
    case 'low':
      return isVp ? 40 : 28;
    default:
      return isVp ? 25 : 18;
  }
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 11,
  backgroundColor: 'var(--color-app-hover)',
  border: '0.5px solid var(--color-border-input)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  outline: 'none',
  cursor: 'pointer',
};

export function RenderSettingsModal({
  isOpen,
  onClose,
  onRender,
  compositionConfig,
}: RenderSettingsModalProps) {
  const [codec, setCodec] = useState<RenderCodec>('h264');
  const [resolution, setResolution] = useState<ResolutionPreset>('original');
  const [fpsPreset, setFpsPreset] = useState<string>('original');
  const [quality, setQuality] = useState('high');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [smoothness, setSmoothness] = useState('1');
  const [loopPreset, setLoopPreset] = useState('forever');
  const [autoDownscaled, setAutoDownscaled] = useState(false);

  const resolutionOptions = getResolutionPresets(
    compositionConfig.width,
    compositionConfig.height
  );

  const selectedResolution = resolutionOptions.find((r) => r.value === resolution) ?? resolutionOptions[0];
  const selectedFps = fpsPreset === 'original' ? compositionConfig.fps : Number(fpsPreset);
  const qualityHint = QUALITY_OPTIONS.find((q) => q.value === quality)?.hint ?? '';
  const isGif = codec === 'gif';

  // Auto-downscale when switching to GIF
  useEffect(() => {
    if (isGif && resolution === 'original') {
      const minDim = Math.min(compositionConfig.width, compositionConfig.height);
      const has480p = resolutionOptions.some((r) => r.value === '480p');
      if (minDim > 480 && has480p) {
        setResolution('480p');
        setAutoDownscaled(true);
      }
    }
    if (!isGif && autoDownscaled) {
      setAutoDownscaled(false);
    }
  }, [isGif, resolution, compositionConfig.width, compositionConfig.height, resolutionOptions, autoDownscaled]);

  const handleRender = useCallback(() => {
    const crf = getCrf(quality, codec);
    const everyNthFrame = isGif ? Number(smoothness) : 1;
    const numberOfGifLoops = isGif
      ? (loopPreset === 'forever' ? null : Number(loopPreset))
      : null;

    // Compute scale factor from selected resolution vs original
    const isLandscape = compositionConfig.width >= compositionConfig.height;
    const scale = resolution === 'original'
      ? 1
      : isLandscape
        ? selectedResolution.height / compositionConfig.height
        : selectedResolution.width / compositionConfig.width;

    onRender({
      codec,
      scale,
      fps: selectedFps,
      crf,
      muted: isGif ? true : !includeAudio,
      everyNthFrame,
      numberOfGifLoops,
    });

    onClose();
  }, [codec, resolution, selectedResolution, selectedFps, quality, includeAudio, isGif, smoothness, loopPreset, compositionConfig, onRender, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Render Settings">
      <div className="flex flex-col gap-4" style={{ minWidth: 360 }}>
        {/* Format */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-text-muted">Format</label>
          <select
            value={codec}
            onChange={(e) => setCodec(e.target.value as RenderCodec)}
            style={selectStyle}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Size */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-text-muted">Size</label>
          <select
            value={resolution}
            onChange={(e) => {
              setResolution(e.target.value as ResolutionPreset);
              setAutoDownscaled(false);
            }}
            style={selectStyle}
          >
            {resolutionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {autoDownscaled && (
            <span className="text-[10px] text-text-dim">Scaled down for smaller file size</span>
          )}
        </div>

        {/* Frame Rate */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-text-muted">Frame Rate</label>
          <select
            value={fpsPreset}
            onChange={(e) => setFpsPreset(e.target.value)}
            style={selectStyle}
          >
            <option value="original">
              Original ({compositionConfig.fps} fps)
            </option>
            {FPS_PRESETS.map((fps) => (
              <option key={fps} value={String(fps)}>
                {fps} fps
              </option>
            ))}
          </select>
        </div>

        {/* Quality — hidden for GIF */}
        {!isGif && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted">Quality</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              style={selectStyle}
            >
              {QUALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-text-dim">{qualityHint}</span>
          </div>
        )}

        {/* Include Audio — hidden for GIF */}
        {!isGif && (
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-text-muted">Include Audio</label>
            <button
              type="button"
              role="switch"
              aria-checked={includeAudio}
              onClick={() => setIncludeAudio((v) => !v)}
              className="relative rounded-full transition-colors"
              style={{
                width: 36,
                height: 20,
                backgroundColor: includeAudio
                  ? 'var(--color-accent)'
                  : 'var(--color-app-hover)',
                border: '0.5px solid var(--color-border-input)',
              }}
            >
              <span
                className="block rounded-full bg-white transition-transform"
                style={{
                  width: 14,
                  height: 14,
                  position: 'absolute',
                  top: 2,
                  left: includeAudio ? 19 : 3,
                  transition: 'left 0.15s ease',
                }}
              />
            </button>
          </div>
        )}

        {/* GIF-specific: Smoothness */}
        {isGif && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted">Smoothness</label>
            <select
              value={smoothness}
              onChange={(e) => setSmoothness(e.target.value)}
              style={selectStyle}
            >
              {SMOOTHNESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-text-dim">
              Fewer frames = smaller file
            </span>
          </div>
        )}

        {/* GIF-specific: Loop */}
        {isGif && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted">Loop</label>
            <select
              value={loopPreset}
              onChange={(e) => setLoopPreset(e.target.value)}
              style={selectStyle}
            >
              {LOOP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div
          className="flex justify-end gap-2 pt-2"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRender}>
            Render
          </Button>
        </div>
      </div>
    </Modal>
  );
}
