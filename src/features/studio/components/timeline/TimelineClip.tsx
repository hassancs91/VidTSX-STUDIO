import { memo } from 'react';
import type { StudioClip, StudioClipKind } from '../../types';
import { secondsToPx } from '../../services/timeline-view';
import { ClipWaveform } from './ClipWaveform';

export type ClipDragKind = 'move' | 'trim-start' | 'trim-end' | 'fade-in' | 'fade-out';

export interface ClipWaveformData {
  peaks: number[];
  peaksPerSecond: number;
}

interface Props {
  clip: StudioClip;
  label: string;
  pxPerSecond: number;
  heightPx: number;
  selected: boolean;
  thumbnail: string | null;
  waveform: ClipWaveformData | null;
  onPointerDown: (event: React.PointerEvent, clip: StudioClip, kind: ClipDragKind) => void;
  onContextMenu?: (event: React.MouseEvent, clip: StudioClip) => void;
}

const AUDIO_KINDS: ReadonlySet<StudioClipKind> = new Set(['video', 'audio', 'sfx']);

const KIND_STYLE: Record<StudioClipKind, { fill: string; border: string }> = {
  video: { fill: 'rgba(127,119,221,0.30)', border: '#7F77DD' },
  image: { fill: 'rgba(239,159,39,0.28)', border: '#EF9F27' },
  audio: { fill: 'rgba(93,202,165,0.26)', border: '#5DCAA5' },
  sfx: { fill: 'rgba(93,202,165,0.26)', border: '#5DCAA5' },
  tsx: { fill: 'rgba(200,180,255,0.26)', border: '#c8b4ff' },
  caption: { fill: 'rgba(240,149,149,0.24)', border: '#F09595' },
};

const HANDLE_WIDTH = 7;

function TimelineClipInner({
  clip,
  label,
  pxPerSecond,
  heightPx,
  selected,
  thumbnail,
  waveform,
  onPointerDown,
  onContextMenu,
}: Props) {
  const width = Math.max(2, secondsToPx(clip.duration, pxPerSecond));
  const left = secondsToPx(clip.timelineStart, pxPerSecond);
  const style = KIND_STYLE[clip.kind] ?? KIND_STYLE.video;
  const showHandles = width > HANDLE_WIDTH * 3;
  const hasAudio = AUDIO_KINDS.has(clip.kind);
  const fadeInPx = hasAudio ? secondsToPx(clip.fadeInSec ?? 0, pxPerSecond) : 0;
  const fadeOutPx = hasAudio ? secondsToPx(clip.fadeOutSec ?? 0, pxPerSecond) : 0;

  return (
    <div
      className="absolute top-[3px] rounded-[4px] overflow-hidden cursor-grab active:cursor-grabbing group"
      style={{
        left,
        width,
        height: heightPx - 6,
        backgroundColor: style.fill,
        border: selected ? `1px solid ${style.border}` : '0.5px solid rgba(255,255,255,0.14)',
        boxShadow: selected ? `0 0 0 1px ${style.border}66` : 'none',
      }}
      onPointerDown={(e) => onPointerDown(e, clip, 'move')}
      onContextMenu={(e) => onContextMenu?.(e, clip)}
      title={label}
    >
      {thumbnail && (
        <div
          className="absolute inset-y-0 left-0 w-[38px] bg-cover bg-center opacity-70 pointer-events-none"
          style={{ backgroundImage: `url(${thumbnail})` }}
        />
      )}

      {waveform && (
        <ClipWaveform
          peaks={waveform.peaks}
          peaksPerSecond={waveform.peaksPerSecond}
          sourceIn={clip.sourceIn ?? 0}
          durationSeconds={clip.duration}
          widthPx={width}
          heightPx={Math.max(10, (heightPx - 6) * 0.5)}
        />
      )}

      <span
        className="absolute top-[2px] left-0 right-0 px-[5px] text-[9px] leading-[12px] text-text-primary truncate pointer-events-none"
        style={{ paddingLeft: thumbnail ? 42 : 5, textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
      >
        {label}
      </span>

      {(fadeInPx > 0 || fadeOutPx > 0) && (
        <FadeRamps widthPx={width} heightPx={heightPx - 6} fadeInPx={fadeInPx} fadeOutPx={fadeOutPx} />
      )}

      {showHandles && (
        <>
          <TrimHandle side="start" onPointerDown={(e) => onPointerDown(e, clip, 'trim-start')} />
          <TrimHandle side="end" onPointerDown={(e) => onPointerDown(e, clip, 'trim-end')} />
        </>
      )}
      {showHandles && hasAudio && (
        <>
          <FadeHandle
            side="start"
            offsetPx={fadeInPx}
            widthPx={width}
            onPointerDown={(e) => onPointerDown(e, clip, 'fade-in')}
          />
          <FadeHandle
            side="end"
            offsetPx={fadeOutPx}
            widthPx={width}
            onPointerDown={(e) => onPointerDown(e, clip, 'fade-out')}
          />
        </>
      )}
    </div>
  );
}

/** Translucent wedges showing the audible fade ramps. */
function FadeRamps({
  widthPx,
  heightPx,
  fadeInPx,
  fadeOutPx,
}: {
  widthPx: number;
  heightPx: number;
  fadeInPx: number;
  fadeOutPx: number;
}) {
  const h = heightPx;
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={widthPx}
      height={h}
      aria-hidden
    >
      {fadeInPx > 0 && (
        <polygon points={`0,0 ${fadeInPx},0 0,${h}`} fill="rgba(0,0,0,0.45)" />
      )}
      {fadeInPx > 0 && (
        <line x1={0} y1={h} x2={fadeInPx} y2={0} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
      )}
      {fadeOutPx > 0 && (
        <polygon
          points={`${widthPx - fadeOutPx},0 ${widthPx},0 ${widthPx},${h}`}
          fill="rgba(0,0,0,0.45)"
        />
      )}
      {fadeOutPx > 0 && (
        <line
          x1={widthPx - fadeOutPx}
          y1={0}
          x2={widthPx}
          y2={h}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1}
        />
      )}
    </svg>
  );
}

/** Top-corner dot that drags a fade length (CapCut-style). Sits where the
 *  ramp currently ends so a set fade can be grabbed again. */
function FadeHandle({
  side,
  offsetPx,
  widthPx,
  onPointerDown,
}: {
  side: 'start' | 'end';
  offsetPx: number;
  widthPx: number;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const x = side === 'start' ? Math.min(offsetPx, widthPx - 6) : Math.min(offsetPx, widthPx - 6);
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      title={side === 'start' ? 'Fade in' : 'Fade out'}
      className="absolute top-[1px] w-[9px] h-[9px] rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
      style={{
        [side === 'start' ? 'left' : 'right']: Math.max(0, x - 4),
        backgroundColor: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.5)',
      }}
    />
  );
}

function TrimHandle({
  side,
  onPointerDown,
}: {
  side: 'start' | 'end';
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
      className="absolute top-0 bottom-0 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity"
      style={{
        [side === 'start' ? 'left' : 'right']: 0,
        width: HANDLE_WIDTH,
        backgroundColor: 'rgba(255,255,255,0.55)',
      }}
    />
  );
}

/** Memoized: a drag re-renders the panel on every pointermove, and only the
 *  dragged clip's props actually change. */
export const TimelineClip = memo(TimelineClipInner);
