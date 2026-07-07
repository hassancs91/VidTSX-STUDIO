import type { FrameExtractionPreset } from '../types';

interface FrameExtractorConfigProps {
  videoName: string;
  videoDuration: number;
  videoFps: number;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  preset: FrameExtractionPreset;
  everyXSeconds: number;
  outputFormat: 'png' | 'jpg';
  estimatedFrames: number;
  onFpsChange: (fps: number) => void;
  onPresetChange: (preset: FrameExtractionPreset) => void;
  onEveryXSecondsChange: (seconds: number) => void;
  onOutputFormatChange: (format: 'png' | 'jpg') => void;
  onExtract: () => void;
  onChangeVideo: () => void;
}

const presetOptions: { value: FrameExtractionPreset; label: string }[] = [
  { value: 'custom', label: 'Custom FPS' },
  { value: 'first-frame', label: 'First Frame' },
  { value: 'last-frame', label: 'Last Frame' },
  { value: 'every-x-seconds', label: 'Every X Sec' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FrameExtractorConfig({
  videoName,
  videoDuration,
  videoFps,
  videoWidth,
  videoHeight,
  fps,
  preset,
  everyXSeconds,
  outputFormat,
  estimatedFrames,
  onFpsChange,
  onPresetChange,
  onEveryXSecondsChange,
  onOutputFormatChange,
  onExtract,
  onChangeVideo,
}: FrameExtractorConfigProps) {
  const maxFps = Math.max(1, Math.round(videoFps));

  return (
    <div className="flex flex-col gap-4 w-full max-w-[500px] mx-auto">
      {/* Video Info Card */}
      <div
        className="flex items-center gap-3 p-3 rounded-[8px] bg-app-surface"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-[6px] bg-app-base">
          <svg
            width="18" height="18" viewBox="0 0 18 18" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-text-muted"
          >
            <rect x="2" y="4" width="14" height="10" rx="1.5" />
            <path d="M7.5 7.5V12L11.5 9.75L7.5 7.5Z" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-text-primary truncate font-medium">{videoName}</p>
          <p className="text-[10px] text-text-dim">
            {videoWidth}x{videoHeight} &middot; {formatDuration(videoDuration)} &middot; {videoFps.toFixed(1)} fps
          </p>
        </div>
        <button
          onClick={onChangeVideo}
          className="text-[10px] text-accent hover:text-accent-light px-2 py-1 rounded-[4px] hover:bg-app-hover transition-colors"
        >
          Change
        </button>
      </div>

      {/* Preset Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-text-dim font-medium uppercase tracking-wide">
          Extraction Mode
        </label>
        <div
          className="flex rounded-[6px] overflow-hidden"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {presetOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPresetChange(opt.value)}
              className={`flex-1 px-[8px] py-[6px] text-[10px] font-medium transition-colors ${
                preset === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{ borderRight: '0.5px solid var(--color-border)' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* FPS Slider — only for custom preset */}
      {preset === 'custom' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-text-dim font-medium uppercase tracking-wide">
              Frames Per Second
            </label>
            <span className="text-[11px] text-text-primary font-medium">{fps}</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxFps}
            value={fps}
            onChange={(e) => onFpsChange(parseInt(e.target.value, 10))}
            className="w-full accent-accent h-[4px]"
          />
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-text-dim">1</span>
            <span className="text-[9px] text-text-dim">{maxFps} (native)</span>
          </div>
        </div>
      )}

      {/* Every X Seconds input */}
      {preset === 'every-x-seconds' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-text-dim font-medium uppercase tracking-wide">
            Extract every
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={Math.max(1, Math.floor(videoDuration))}
              value={everyXSeconds}
              onChange={(e) => onEveryXSecondsChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-[80px] px-2 py-1.5 text-[11px] bg-app-base text-text-primary rounded-[6px] outline-none"
              style={{ border: '0.5px solid var(--color-border-input)' }}
            />
            <span className="text-[11px] text-text-muted">seconds</span>
          </div>
        </div>
      )}

      {/* Output Format */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-text-dim font-medium uppercase tracking-wide">
          Output Format
        </label>
        <div
          className="flex rounded-[6px] overflow-hidden w-[140px]"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {(['png', 'jpg'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onOutputFormatChange(fmt)}
              className={`flex-1 px-[8px] py-[5px] text-[10px] font-medium uppercase transition-colors ${
                outputFormat === fmt
                  ? 'bg-accent text-white'
                  : 'bg-app-base text-text-muted hover:bg-app-hover'
              }`}
              style={{ borderRight: fmt === 'png' ? '0.5px solid var(--color-border)' : undefined }}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated Frames */}
      <div
        className="flex items-center justify-between p-2.5 rounded-[6px] bg-app-surface"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] text-text-muted">Estimated frames</span>
        <span className="text-[12px] text-text-primary font-medium">
          {estimatedFrames.toLocaleString()}
        </span>
      </div>

      {/* Extract Button */}
      <button
        onClick={onExtract}
        className="w-full py-2.5 rounded-[6px] bg-accent text-white text-[12px] font-medium hover:brightness-110 transition-all"
      >
        Extract Frames
      </button>
    </div>
  );
}
