import type { VideoModelInfoIpc } from '@shared/ipc/types';

interface VideoModelFieldsProps {
  model: VideoModelInfoIpc;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  resolution: string | undefined;
  onResolutionChange: (resolution: string) => void;
  generateAudio: boolean;
  onGenerateAudioChange: (on: boolean) => void;
  disabled?: boolean;
}

const CHIP_ON = 'bg-accent/20 text-accent-light border border-accent';
const CHIP_OFF = 'bg-app-base text-text-muted border border-border hover:border-text-dim';

/**
 * Duration, aspect, resolution and audio — every option read from the chosen
 * model's published capabilities, so the panel offers only what that model
 * accepts instead of a union the engine would silently clamp.
 */
export function VideoModelFields({
  model,
  durationSeconds,
  onDurationChange,
  aspectRatio,
  onAspectRatioChange,
  resolution,
  onResolutionChange,
  generateAudio,
  onGenerateAudioChange,
  disabled = false,
}: VideoModelFieldsProps) {
  const { durations } = model;

  return (
    <>
      {/* Duration — discrete values become chips, a range becomes a slider */}
      <div>
        <div className="text-[10px] text-text-dim mb-1">
          Duration
          {durations.kind === 'range' && (
            <span className="text-text-dim/70">
              {' '}
              — {durationSeconds}s ({durations.min}–{durations.max}s)
            </span>
          )}
        </div>
        {durations.kind === 'discrete' ? (
          <div className="flex flex-wrap gap-1">
            {durations.values.map((value) => (
              <button
                key={value}
                type="button"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  durationSeconds === value ? CHIP_ON : CHIP_OFF
                }`}
                onClick={() => onDurationChange(value)}
                disabled={disabled}
              >
                {value}s
              </button>
            ))}
          </div>
        ) : (
          <input
            type="range"
            className="w-full accent-accent cursor-pointer"
            min={durations.min}
            max={durations.max}
            step={1}
            value={durationSeconds}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            disabled={disabled}
          />
        )}
      </div>

      {/* Aspect ratio */}
      <div>
        <div className="text-[10px] text-text-dim mb-1">Aspect Ratio</div>
        <div className="flex flex-wrap gap-1">
          {model.aspectRatios.map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                aspectRatio === ratio ? CHIP_ON : CHIP_OFF
              }`}
              onClick={() => onAspectRatioChange(ratio)}
              disabled={disabled}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution — absent on models whose endpoint has no resolution field */}
      {model.resolutions && model.resolutions.length > 0 && (
        <div>
          <div className="text-[10px] text-text-dim mb-1">Resolution</div>
          <div className="flex flex-wrap gap-1">
            {model.resolutions.map((res) => (
              <button
                key={res}
                type="button"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  resolution === res ? CHIP_ON : CHIP_OFF
                }`}
                onClick={() => onResolutionChange(res)}
                disabled={disabled}
              >
                {res}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio — only where the model generates it */}
      {model.supports.audio && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-accent cursor-pointer"
            checked={generateAudio}
            onChange={(e) => onGenerateAudioChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="text-[11px] text-text-secondary">Generate audio</span>
        </label>
      )}
    </>
  );
}
