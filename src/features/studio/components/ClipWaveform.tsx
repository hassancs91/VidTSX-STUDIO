import { useMemo } from 'react';
import { getWaveformPortion } from '@remotion/media-utils';
import { useAudioWaveform } from '../hooks/useAudioWaveform';

// Draws the audio waveform for a single timeline clip, filling the clip body
// behind its title label. Decoding is cached per source URL (see
// useAudioWaveform); while it loads — or if a video's audio can't be decoded —
// this renders nothing, leaving the plain solid clip.

interface ClipWaveformProps {
  url: string;
  // Source-time window the clip shows: [inPointSeconds, inPointSeconds + durationSeconds].
  inPointSeconds: number;
  durationSeconds: number;
  // Bar color (defaults to a translucent white that reads on any track color).
  color?: string;
}

// ~24 bars/sec of clip, clamped — enough detail to read the shape without
// over-sampling tiny clips or melting long ones.
function sampleCount(durationSeconds: number): number {
  return Math.max(12, Math.min(400, Math.round(durationSeconds * 24)));
}

export function ClipWaveform({
  url,
  inPointSeconds,
  durationSeconds,
  color = 'rgba(255,255,255,0.55)',
}: ClipWaveformProps) {
  const { data } = useAudioWaveform(url);

  const bars = useMemo(() => {
    if (!data || durationSeconds <= 0) return null;
    try {
      return getWaveformPortion({
        audioData: data,
        startTimeInSeconds: Math.max(0, inPointSeconds),
        durationInSeconds: durationSeconds,
        numberOfSamples: sampleCount(durationSeconds),
        outputRange: 'zero-to-one',
        normalize: true,
      });
    } catch {
      return null;
    }
  }, [data, inPointSeconds, durationSeconds]);

  if (!bars || bars.length === 0) return null;

  const n = bars.length;
  // Symmetric bars around the vertical center, drawn in a 0..100 viewBox that
  // stretches to the clip width via preserveAspectRatio="none".
  const barWidth = 100 / n;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {bars.map((bar, i) => {
        const h = Math.max(1.5, bar.amplitude * 96);
        const x = i * barWidth;
        return (
          <rect
            key={bar.index ?? i}
            x={x}
            y={(100 - h) / 2}
            width={Math.max(0.2, barWidth * 0.7)}
            height={h}
            rx={0.4}
            fill={color}
          />
        );
      })}
    </svg>
  );
}
