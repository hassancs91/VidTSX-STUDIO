import { useMemo } from 'react';

interface TimeRulerProps {
  durationInSeconds: number;
  width: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTickInterval(duration: number): number {
  if (duration <= 30) return 5;
  if (duration <= 120) return 10;
  if (duration <= 300) return 30;
  if (duration <= 600) return 60;
  return 120;
}

export function TimeRuler({ durationInSeconds, width }: TimeRulerProps) {
  const ticks = useMemo(() => {
    const interval = getTickInterval(durationInSeconds);
    const result: { time: number; x: number; label: string }[] = [];

    for (let t = 0; t <= durationInSeconds; t += interval) {
      const x = (t / durationInSeconds) * width;
      result.push({ time: t, x, label: formatTime(t) });
    }

    return result;
  }, [durationInSeconds, width]);

  return (
    <div
      className="relative h-[24px] select-none"
      style={{ width, backgroundColor: 'var(--color-app-surface)' }}
    >
      {ticks.map((tick) => (
        <div key={tick.time} className="absolute top-0 h-full" style={{ left: tick.x }}>
          <div
            className="absolute bottom-0 w-px h-[8px]"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <span
            className="absolute top-[2px] text-text-dim"
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
            }}
          >
            {tick.label}
          </span>
        </div>
      ))}
    </div>
  );
}
