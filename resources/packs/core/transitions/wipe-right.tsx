import React, {type CSSProperties, type ReactNode} from 'react';

/** A pure, seekable scene transition. Host controls the timeline and scene media. */
export interface TransitionProps {
  outgoing: ReactNode;
  incoming: ReactNode;
  /** Normalized time: 0 = outgoing, 1 = incoming. Out-of-range values clamp. */
  progress: number;
  width?: number;
  height?: number;
  accent?: string;
  background?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => n * n * (3 - 2 * n);
const fill: CSSProperties = {position: 'absolute', inset: 0, width: '100%', height: '100%'};

export default function WipeRight({
  outgoing, incoming, progress, width = 1920, height = 1080,
  accent = '#f6a86a', background = '#090b0d',
}: TransitionProps) {
  const raw = clamp(Number.isNaN(progress) ? 0 : progress);
  const p = ease(raw);
  const stage: CSSProperties = {position: 'relative', width, height, overflow: 'hidden', isolation: 'isolate', background};
  // Exact endpoints also avoid mask seams, duplicate scenes and residual effects.
  if (raw === 0 || raw === 1) return <div style={stage}>{raw === 0 ? outgoing : incoming}</div>;
  return <div style={stage}><div style={fill}>{outgoing}</div><div style={{...fill, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`}}>{incoming}</div></div>;
}
