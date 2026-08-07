import { memo } from 'react';
import type { StudioClip, StudioClipKind } from '../../types';
import { secondsToPx } from '../../services/timeline-view';
import { ClipWaveform } from './ClipWaveform';

export type ClipDragKind = 'move' | 'trim-start' | 'trim-end';

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
}

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
}: Props) {
  const width = Math.max(2, secondsToPx(clip.duration, pxPerSecond));
  const left = secondsToPx(clip.timelineStart, pxPerSecond);
  const style = KIND_STYLE[clip.kind] ?? KIND_STYLE.video;
  const showHandles = width > HANDLE_WIDTH * 3;

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

      {showHandles && (
        <>
          <TrimHandle side="start" onPointerDown={(e) => onPointerDown(e, clip, 'trim-start')} />
          <TrimHandle side="end" onPointerDown={(e) => onPointerDown(e, clip, 'trim-end')} />
        </>
      )}
    </div>
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
