import { useState, useEffect, useCallback } from 'react';
import { Modal, Button } from '@shared/components';
import type { RenderCodec, RenderGpuBackend, RenderHardwareAcceleration } from '@shared/ipc/types';
import { snapRenderScale } from '@shared/render-scale';

export interface RenderSettings {
  codec: RenderCodec;
  scale: number;
  fps: number;
  crf: number;
  muted: boolean;
  everyNthFrame: number;
  numberOfGifLoops: number | null;
  transparent: boolean;
  // CPU usage cap passed to Remotion's renderMedia() as `concurrency`.
  // Accepts a string percentage ("25%" / "50%" / "75%") or null for unlimited.
  cpuUsage: string | null;
  // Chromium GL backend passed to Remotion's chromiumOptions.gl.
  gpuBackend: RenderGpuBackend;
  // Video-encoder routing for renderMedia's hardwareAcceleration option.
  hardwareAcceleration: RenderHardwareAcceleration;
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
  { value: 'prores' as RenderCodec, label: 'MOV (ProRes 4444)' },
  { value: 'gif' as RenderCodec, label: 'GIF' },
  { value: 'webp' as RenderCodec, label: 'WebP (animated)' },
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

const CPU_USAGE_OPTIONS: { value: string; label: string; hint: string; concurrency: string | null }[] = [
  { value: 'low', label: 'Low \u2014 25%', hint: 'Machine stays fully usable', concurrency: '25%' },
  { value: 'medium', label: 'Medium \u2014 50%', hint: 'Balanced', concurrency: '50%' },
  { value: 'high', label: 'High \u2014 75%', hint: 'Faster render', concurrency: '75%' },
  { value: 'max', label: 'Max \u2014 all cores', hint: 'Fastest; may lag the system', concurrency: null },
];

export const GPU_BACKEND_OPTIONS: { value: RenderGpuBackend; label: string; hint: string }[] = [
  { value: 'swangle',     label: 'Software (default)',  hint: 'Safe everywhere \u2014 slowest for WebGL/3D scenes' },
  { value: 'angle',       label: 'ANGLE (Direct3D 11)', hint: 'GPU via D3D11 \u2014 best Windows compatibility' },
  { value: 'angle-egl',   label: 'ANGLE (EGL)',         hint: 'GPU via ANGLE/EGL \u2014 alternative ANGLE backend' },
  { value: 'egl',         label: 'EGL',                 hint: 'GPU via native EGL \u2014 Linux/embedded GPUs' },
  { value: 'vulkan',      label: 'Vulkan',              hint: 'GPU via Vulkan \u2014 newest, often fastest, may crash on older drivers' },
  { value: 'swiftshader', label: 'SwiftShader',         hint: 'Pure CPU shader emulation \u2014 slower than swangle' },
];

export const HARDWARE_ACCELERATION_OPTIONS: { value: RenderHardwareAcceleration; label: string; hint: string }[] = [
  { value: 'if-possible', label: 'If possible (default)', hint: 'Use GPU encoder (NVENC/QSV/AMF/VideoToolbox) when available, fall back to CPU silently' },
  { value: 'disable',     label: 'Disabled',              hint: 'Always use CPU encoding \u2014 safest, works everywhere' },
  { value: 'required',    label: 'Required',              hint: 'Force GPU encoder \u2014 fails if unavailable. Not compatible with ProRes' },
];

const FPS_PRESETS = [60, 30, 25, 24, 15];

type ResolutionPreset = 'original' | '4k' | '1080p' | '720p' | '480p';

interface ResolutionOption {
  value: ResolutionPreset;
  label: string;
  width: number;
  height: number;
  // Exact scale factor the renderer will apply — snapped so output dims are
  // even integers (see snapRenderScale). Label dims match this scale.
  scale: number;
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
      scale: 1,
    },
  ];

  for (const p of presets) {
    const requestedScale = isLandscape
      ? p.targetHeight / compHeight
      : p.targetHeight / compWidth;

    // Snap to a scale with exact even-integer output dims so the label shows
    // what actually renders (e.g. 480p from 1080p lands on 864\u00d7486). When no
    // nearby scale exists, keep the approximate dims \u2014 the renderer falls
    // back to materializing them.
    const snapped = snapRenderScale(compWidth, compHeight, requestedScale);
    let width: number;
    let height: number;
    if (snapped) {
      width = snapped.width;
      height = snapped.height;
    } else if (isLandscape) {
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
      scale: snapped ? snapped.scale : requestedScale,
    });
  }

  return options;
}

function getCrf(quality: string, codec: RenderCodec): number {
  if (codec === 'gif') return 0;

  // WebP reuses the crf field as canvas encoder quality, 1–100 with higher =
  // better; 100 selects Chromium's lossless mode (see RenderCodec docs).
  if (codec === 'webp') {
    switch (quality) {
      case 'best':
        return 100;
      case 'high':
        return 90;
      case 'medium':
        return 80;
      case 'low':
        return 65;
      default:
        return 90;
    }
  }

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
  const [transparent, setTransparent] = useState(false);
  const [cpuUsage, setCpuUsage] = useState<string>('medium');
  const [gpuBackend, setGpuBackend] = useState<RenderGpuBackend>('swangle');
  const [hardwareAcceleration, setHardwareAcceleration] = useState<RenderHardwareAcceleration>('if-possible');

  // Load the user's default CPU + GPU + hwaccel presets from Settings and
  // apply them whenever the modal opens — this resets any per-render override
  // so each new job starts from the user's preferred defaults.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    window.api.settingsGet()
      .then((s) => {
        if (cancelled) return;
        if (s.renderDefaultCpuUsage) {
          setCpuUsage(s.renderDefaultCpuUsage);
        }
        if (s.renderDefaultGpuBackend) {
          setGpuBackend(s.renderDefaultGpuBackend);
        }
        if (s.renderDefaultHardwareAcceleration) {
          setHardwareAcceleration(s.renderDefaultHardwareAcceleration);
        }
      })
      .catch(() => {
        // Falls back to the initial defaults — nothing to do.
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const resolutionOptions = getResolutionPresets(
    compositionConfig.width,
    compositionConfig.height
  );

  const selectedResolution = resolutionOptions.find((r) => r.value === resolution) ?? resolutionOptions[0];
  const selectedFps = fpsPreset === 'original' ? compositionConfig.fps : Number(fpsPreset);
  const qualityHint = QUALITY_OPTIONS.find((q) => q.value === quality)?.hint ?? '';
  const isGif = codec === 'gif';
  const isWebp = codec === 'webp';
  // GIF and animated WebP share the frame-sequence options: no audio track,
  // loop control, frame skipping, and the auto-downscale default.
  const isAnimatedImage = isGif || isWebp;
  const isWebm = codec === 'vp8' || codec === 'vp9';
  const isProRes = codec === 'prores';
  const supportsAlpha = isWebm || isProRes || isWebp;

  // Reset transparency when leaving an alpha-capable codec — the toggle is
  // hidden so its state would otherwise leak into the next render with an
  // incompatible codec.
  useEffect(() => {
    if (!supportsAlpha && transparent) {
      setTransparent(false);
    }
  }, [supportsAlpha, transparent]);

  // Auto-downscale when switching to GIF or animated WebP
  useEffect(() => {
    if (isAnimatedImage && resolution === 'original') {
      const minDim = Math.min(compositionConfig.width, compositionConfig.height);
      const has480p = resolutionOptions.some((r) => r.value === '480p');
      if (minDim > 480 && has480p) {
        setResolution('480p');
        setAutoDownscaled(true);
      }
    }
    if (!isAnimatedImage && autoDownscaled) {
      setAutoDownscaled(false);
    }
  }, [isAnimatedImage, resolution, compositionConfig.width, compositionConfig.height, resolutionOptions, autoDownscaled]);

  const handleRender = useCallback(() => {
    const crf = getCrf(quality, codec);
    const everyNthFrame = isAnimatedImage ? Number(smoothness) : 1;
    const numberOfGifLoops = isAnimatedImage
      ? (loopPreset === 'forever' ? null : Number(loopPreset))
      : null;

    // The option carries the exact (snapped) scale its label dims were
    // computed from — pass it through unchanged.
    const scale = selectedResolution.scale;

    const cpuOption = CPU_USAGE_OPTIONS.find((o) => o.value === cpuUsage) ?? CPU_USAGE_OPTIONS[1];

    onRender({
      codec,
      scale,
      fps: selectedFps,
      crf,
      muted: isAnimatedImage ? true : !includeAudio,
      everyNthFrame,
      numberOfGifLoops,
      transparent: supportsAlpha ? transparent : false,
      cpuUsage: cpuOption.concurrency,
      gpuBackend,
      hardwareAcceleration,
    });

    onClose();
  }, [codec, resolution, selectedResolution, selectedFps, quality, includeAudio, isAnimatedImage, supportsAlpha, transparent, smoothness, loopPreset, cpuUsage, gpuBackend, hardwareAcceleration, compositionConfig, onRender, onClose]);

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
          {isProRes && (
            <span className="text-[10px] text-text-dim">
              Large file — best for editor overlays.
            </span>
          )}
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

        {/* Quality — hidden for GIF and ProRes (ProRes quality is set by the profile, not CRF) */}
        {!isGif && !isProRes && (
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

        {/* Include Audio — hidden for GIF/WebP (no audio track) */}
        {!isAnimatedImage && (
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

        {/* Transparent background — supported by WebM (VP8/VP9), ProRes 4444, and animated WebP */}
        {supportsAlpha && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-text-muted">Transparent background</label>
              <button
                type="button"
                role="switch"
                aria-checked={transparent}
                onClick={() => setTransparent((v) => !v)}
                className="relative rounded-full transition-colors"
                style={{
                  width: 36,
                  height: 20,
                  backgroundColor: transparent
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
                    left: transparent ? 19 : 3,
                    transition: 'left 0.15s ease',
                  }}
                />
              </button>
            </div>
            <span className="text-[10px] text-text-dim">
              Your composition root must not set a background color.
            </span>
          </div>
        )}

        {/* GIF/WebP: Smoothness */}
        {isAnimatedImage && (
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

        {/* GIF/WebP: Loop */}
        {isAnimatedImage && (
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

        {/* CPU usage */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-text-muted">CPU usage</label>
          <select
            value={cpuUsage}
            onChange={(e) => setCpuUsage(e.target.value)}
            style={selectStyle}
          >
            {CPU_USAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-text-dim">
            {CPU_USAGE_OPTIONS.find((o) => o.value === cpuUsage)?.hint ?? ''}
          </span>
        </div>

        {/* GPU backend */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-text-muted">GPU backend</label>
          <select
            value={gpuBackend}
            onChange={(e) => setGpuBackend(e.target.value as RenderGpuBackend)}
            style={selectStyle}
          >
            {GPU_BACKEND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-text-dim">
            {GPU_BACKEND_OPTIONS.find((o) => o.value === gpuBackend)?.hint ?? ''}
          </span>
        </div>

        {/* Hardware video encoding */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-text-muted">Hardware video encoding</label>
          <select
            value={hardwareAcceleration}
            onChange={(e) => setHardwareAcceleration(e.target.value as RenderHardwareAcceleration)}
            style={selectStyle}
          >
            {HARDWARE_ACCELERATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-text-dim">
            {HARDWARE_ACCELERATION_OPTIONS.find((o) => o.value === hardwareAcceleration)?.hint ?? ''}
          </span>
        </div>

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
