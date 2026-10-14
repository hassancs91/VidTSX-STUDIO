// The Creator composer's length: a slider in seconds, or Auto (the builder
// decides the length from the idea).

import { DURATION_RANGE } from '../types';

interface Props {
  duration: number;
  onDurationChange: (value: number) => void;
  autoDuration: boolean;
  onAutoDurationChange: (value: boolean) => void;
  disabled?: boolean;
}

export function MotionDurationField({ duration, onDurationChange, autoDuration, onAutoDurationChange, disabled }: Props) {
  return (
    <div className="px-3 pb-3 flex flex-col gap-1" data-motion-duration>
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-text-dim">
          Duration <span className="text-text-dim">{autoDuration ? '(builder decides)' : `(${duration}s)`}</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDuration}
            onChange={(e) => onAutoDurationChange(e.target.checked)}
            disabled={disabled}
            className="accent-accent cursor-pointer"
          />
          <span className="text-[9px] text-text-dim">Auto</span>
        </label>
      </div>
      <input
        type="range"
        min={DURATION_RANGE.min}
        max={DURATION_RANGE.max}
        value={duration}
        onChange={(e) => onDurationChange(Number(e.target.value))}
        disabled={disabled || autoDuration}
        className="w-full accent-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ height: 18 }}
      />
      <div className="flex justify-between text-[9px] text-text-dim">
        <span>{DURATION_RANGE.min}s</span>
        <span>{DURATION_RANGE.max}s</span>
      </div>
    </div>
  );
}
