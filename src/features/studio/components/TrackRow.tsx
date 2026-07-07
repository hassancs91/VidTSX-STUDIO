import { useCallback, useRef, useState } from 'react';
import type { StudioTrack } from '../types';
import type { TimelineSlot, TimelineHiddenChip, TimelinePendingCut, TimelineAnimation } from './StudioTimeline';
import { HiddenSegmentChip } from './HiddenSegmentChip';
import { ClipWaveform } from './ClipWaveform';
import { MIN_ANIMATION_DURATION_SECONDS } from '../services/animations';

interface TrackRowProps {
  track: StudioTrack;
  isEven: boolean;
  clips?: TimelineSlot[];
  durationInSeconds?: number;
  // Row height in px. Driven by the timeline panel height so tracks grow/shrink
  // vertically as the panel is resized/maximized. Defaults to the compact 28px.
  height?: number;
  isHidden?: boolean;
  isActive?: boolean;
  // Timeline view toggles (per project). Hide the file-name label / the audio
  // waveform painted inside each clip on this track.
  hideFileNames?: boolean;
  hideWaveform?: boolean;
  // Primary selection on this track (strong ring); drives the editor panels.
  selectedClipId?: string | null;
  // All selected ids on this track (every one gets a highlight ring).
  selectedClipIds?: Set<string>;
  // True when the overall selection spans more than one clip — enables
  // group-drag (dragging any selected clip moves the whole selection).
  isMultiSelect?: boolean;
  onToggleVisibility?: () => void;
  onActivate?: () => void;
  // `additive` (ctrl/cmd) toggles this clip in the selection instead of replacing.
  onSelectClip?: (clipId: string | null, additive?: boolean) => void;
  // Animation arrows are drawn on the PRIMARY-selected clip only. The focused
  // arrow id highlights; selecting/updating routes to the parent (which targets
  // the selected clip). Move/trim are resolved here into start/duration patches.
  selectedAnimationId?: string | null;
  onSelectAnimation?: (animId: string | null) => void;
  onUpdateAnimation?: (
    animId: string,
    patch: { startSeconds?: number; durationSeconds?: number }
  ) => void;
  // Right-click a clip — opens the attributes context menu at the cursor.
  onClipContextMenu?: (clipId: string, x: number, y: number) => void;
  onMoveClip?: (clipId: string, newStartTime: number) => void;
  onTrimClip?: (clipId: string, edge: 'start' | 'end', newTime: number) => void;
  // Group move: snapshot positions on start, shift the whole selection by a
  // delta (seconds) per drag step, clear on end.
  onMoveSelectionStart?: () => void;
  onMoveSelectionBy?: (deltaSeconds: number) => void;
  onMoveSelectionEnd?: () => void;
  // Audio rows only: drop a clip onto the other audio row (SFX ↔ Music) to
  // reclassify it. Resolved on mouseup via the row under the cursor.
  onSwitchTrack?: (clipId: string, toTrack: 'sfx' | 'music') => void;
  // Fired when a clip drag/trim gesture begins/ends, so the parent can freeze
  // the timeline scale for the gesture's duration.
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
  hiddenChips?: TimelineHiddenChip[];
  onRestoreHidden?: (clipId: string) => void;
  onDeleteHidden?: (clipId: string) => void;
  pendingCuts?: TimelinePendingCut[];
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 7C2.5 4 4.5 2.5 7 2.5C9.5 2.5 11.5 4 13 7C11.5 10 9.5 11.5 7 11.5C4.5 11.5 2.5 10 1 7Z" />
          <circle cx="7" cy="7" r="1.8" />
        </>
      ) : (
        <>
          <path d="M1 7C2.5 4 4.5 2.5 7 2.5C9.5 2.5 11.5 4 13 7C11.5 10 9.5 11.5 7 11.5C4.5 11.5 2.5 10 1 7Z" />
          <path d="M2 2L12 12" />
        </>
      )}
    </svg>
  );
}

export function TrackRow({ track, isEven, clips, durationInSeconds, height = 28, isHidden = false, isActive = false, hideFileNames = false, hideWaveform = false, selectedClipId, selectedClipIds, isMultiSelect = false, selectedAnimationId, onSelectAnimation, onUpdateAnimation, onToggleVisibility, onActivate, onSelectClip, onClipContextMenu, onMoveClip, onTrimClip, onSwitchTrack, onMoveSelectionStart, onMoveSelectionBy, onMoveSelectionEnd, onInteractStart, onInteractEnd, hiddenChips, onRestoreHidden, onDeleteHidden, pendingCuts }: TrackRowProps) {
  const isAudioTrack = track.type === 'sfx' || track.type === 'music';
  const hasClips = clips && clips.length > 0 && durationInSeconds;
  const hasHiddenChips =
    !!hiddenChips && hiddenChips.length > 0 && durationInSeconds && durationInSeconds > 0;
  const hasPendingCuts =
    !!pendingCuts && pendingCuts.length > 0 && durationInSeconds && durationInSeconds > 0;

  const clipsContentRef = useRef<HTMLDivElement>(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [trimmingClip, setTrimmingClip] = useState<{ id: string; edge: 'start' | 'end' } | null>(null);
  // Set while an animation arrow on the selected clip is being dragged/trimmed,
  // so the band shows a grabbing state and we freeze the timeline scale.
  const [interactingAnimId, setInteractingAnimId] = useState<string | null>(null);

  const handleClipDragStart = useCallback(
    (e: React.MouseEvent, clip: TimelineSlot) => {
      // Always stop propagation so the timeline background mouseDown
      // (which deselects + seeks) doesn't fire when interacting with a clip.
      e.stopPropagation();

      // Ignore non-primary buttons (right-click is handled by onContextMenu).
      if (e.button !== 0) return;

      // Ctrl/Cmd+click toggles this clip in the multi-selection — no drag.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onSelectClip?.(clip.id, true);
        return;
      }

      // Group drag: dragging a clip that's part of a multi-selection moves the
      // whole selection together. We keep the selection intact (a click without
      // a real drag collapses it to this clip on mouseup).
      const isSelectedHere = selectedClipIds?.has(clip.id) ?? false;
      const groupDrag = isMultiSelect && isSelectedHere && !!onMoveSelectionBy;

      if (!groupDrag) onSelectClip?.(clip.id);
      if (!durationInSeconds) return;
      if (!groupDrag && !onMoveClip) return;
      e.preventDefault();

      const container = clipsContentRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      if (containerWidth <= 0) return;

      const startX = e.clientX;
      const initialStartTime = clip.startTime;
      let moved = false;

      setDraggingClipId(clip.id);
      onInteractStart?.();
      if (groupDrag) onMoveSelectionStart?.();
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const handleMove = (ev: MouseEvent) => {
        const deltaPx = ev.clientX - startX;
        if (Math.abs(deltaPx) > 2) moved = true;
        const deltaSeconds = (deltaPx / containerWidth) * durationInSeconds;
        if (groupDrag) {
          // The whole selection shifts by the same delta; the executor applies
          // a collective clamp so relative spacing is preserved.
          onMoveSelectionBy?.(deltaSeconds);
        } else {
          // No upper clamp — dragging toward/past the end grows the timeline
          // live (handlers clamp against the live timeline / prevent overlap).
          const next = Math.max(0, initialStartTime + deltaSeconds);
          onMoveClip?.(clip.id, next);
        }
      };

      const handleUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setDraggingClipId(null);
        if (groupDrag) {
          onMoveSelectionEnd?.();
          // A click (no real drag) on a clip in the selection collapses down to
          // just that clip.
          if (!moved) onSelectClip?.(clip.id);
        } else if (isAudioTrack && onSwitchTrack) {
          // Audio drag-to-switch: if the pointer was released over the OTHER
          // audio row, reclassify the clip (SFX ↔ Music). The row content div
          // carries a `data-audio-track` marker we resolve via elementFromPoint.
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          const rowEl = el?.closest('[data-audio-track]');
          const toTrack = rowEl?.getAttribute('data-audio-track');
          if ((toTrack === 'sfx' || toTrack === 'music') && toTrack !== track.id) {
            onSwitchTrack(clip.id, toTrack);
          }
        }
        onInteractEnd?.();
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [onMoveClip, onSelectClip, durationInSeconds, onInteractStart, onInteractEnd, isAudioTrack, onSwitchTrack, track.id, isMultiSelect, selectedClipIds, onMoveSelectionStart, onMoveSelectionBy, onMoveSelectionEnd]
  );

  const handleClipTrimStart = useCallback(
    (e: React.MouseEvent, clip: TimelineSlot, edge: 'start' | 'end') => {
      e.stopPropagation();
      onSelectClip?.(clip.id);
      if (!onTrimClip || !durationInSeconds) return;
      e.preventDefault();

      const container = clipsContentRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      if (containerWidth <= 0) return;

      const startX = e.clientX;
      const initialTime = edge === 'start' ? clip.startTime : clip.endTime;

      setTrimmingClip({ id: clip.id, edge });
      onInteractStart?.();
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const handleMove = (ev: MouseEvent) => {
        const deltaPx = ev.clientX - startX;
        const deltaSeconds = (deltaPx / containerWidth) * durationInSeconds;
        onTrimClip(clip.id, edge, initialTime + deltaSeconds);
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setTrimmingClip(null);
        onInteractEnd?.();
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [onTrimClip, onSelectClip, durationInSeconds, onInteractStart, onInteractEnd]
  );

  // Drag an animation arrow's body to reposition it within its clip. The
  // px→seconds scale is the timeline's (same coordinate space as the clip), so
  // the delta in timeline-seconds equals the clip-relative-seconds delta.
  const handleAnimMoveStart = useCallback(
    (e: React.MouseEvent, clip: TimelineSlot, anim: TimelineAnimation) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      onSelectAnimation?.(anim.id);
      if (!onUpdateAnimation || !durationInSeconds) return;
      e.preventDefault();

      const container = clipsContentRef.current;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth <= 0) return;

      const clipDuration = clip.endTime - clip.startTime;
      const maxStart = Math.max(0, clipDuration - anim.durationSeconds);
      const startX = e.clientX;
      const initialStart = anim.startSeconds;

      setInteractingAnimId(anim.id);
      onInteractStart?.();
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      const handleMove = (ev: MouseEvent) => {
        const deltaSeconds = ((ev.clientX - startX) / containerWidth) * durationInSeconds;
        const next = Math.max(0, Math.min(maxStart, initialStart + deltaSeconds));
        onUpdateAnimation(anim.id, { startSeconds: next });
      };
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setInteractingAnimId(null);
        onInteractEnd?.();
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [onSelectAnimation, onUpdateAnimation, durationInSeconds, onInteractStart, onInteractEnd]
  );

  // Drag an arrow's edge to retime it. The start edge moves the left end (keeping
  // the right fixed); the end edge changes the length. Both clamp to the clip and
  // a minimum length.
  const handleAnimTrimStart = useCallback(
    (e: React.MouseEvent, clip: TimelineSlot, anim: TimelineAnimation, edge: 'start' | 'end') => {
      e.stopPropagation();
      onSelectAnimation?.(anim.id);
      if (!onUpdateAnimation || !durationInSeconds) return;
      e.preventDefault();

      const container = clipsContentRef.current;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth <= 0) return;

      const clipDuration = clip.endTime - clip.startTime;
      const startX = e.clientX;
      const initialStart = anim.startSeconds;
      const initialEnd = anim.startSeconds + anim.durationSeconds;

      setInteractingAnimId(anim.id);
      onInteractStart?.();
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const handleMove = (ev: MouseEvent) => {
        const deltaSeconds = ((ev.clientX - startX) / containerWidth) * durationInSeconds;
        if (edge === 'start') {
          const start = Math.max(
            0,
            Math.min(initialEnd - MIN_ANIMATION_DURATION_SECONDS, initialStart + deltaSeconds)
          );
          onUpdateAnimation(anim.id, { startSeconds: start, durationSeconds: initialEnd - start });
        } else {
          const end = Math.max(
            initialStart + MIN_ANIMATION_DURATION_SECONDS,
            Math.min(clipDuration, initialEnd + deltaSeconds)
          );
          onUpdateAnimation(anim.id, { durationSeconds: end - initialStart });
        }
      };
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setInteractingAnimId(null);
        onInteractEnd?.();
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [onSelectAnimation, onUpdateAnimation, durationInSeconds, onInteractStart, onInteractEnd]
  );

  return (
    <div
      className="relative flex items-center"
      style={{
        height,
        backgroundColor: isEven
          ? 'var(--color-app-base)'
          : 'var(--color-app-surface)',
      }}
    >
      {/* Active-track indicator (left-edge accent bar) */}
      {isActive && (
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{ width: 2, backgroundColor: 'var(--color-accent)' }}
        />
      )}

      {/* Track label column. Clicking activates the track (the eye-icon
          button stops propagation, so it keeps its own click behavior). */}
      <div
        className={`flex items-center gap-[6px] px-[8px] shrink-0 ${onActivate ? 'cursor-pointer' : ''}`}
        style={{
          width: 80,
          borderRight: '0.5px solid var(--color-border)',
        }}
        onClick={onActivate}
        title={onActivate ? (isActive ? `Deactivate ${track.label} track` : `Activate ${track.label} track`) : undefined}
      >
        {onToggleVisibility ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className={`shrink-0 cursor-pointer transition-colors ${isHidden ? 'text-text-dim hover:text-text-muted' : 'text-text-muted hover:text-text-primary'}`}
            title={isHidden ? `Show ${track.label} track` : `Hide ${track.label} track`}
          >
            <EyeIcon open={!isHidden} />
          </button>
        ) : (
          <div
            className="w-[8px] h-[8px] rounded-full shrink-0"
            style={{ backgroundColor: track.color }}
          />
        )}
        <span className={`text-[11px] truncate ${isActive ? 'text-text-primary font-medium' : isHidden ? 'text-text-dim line-through' : 'text-text-muted'}`}>
          {track.label}
        </span>
      </div>

      {/* Track content area */}
      <div
        className={`flex-1 h-full px-[2px] py-[4px] flex items-stretch relative ${isHidden ? 'opacity-40' : ''}`}
        data-audio-track={isAudioTrack ? track.id : undefined}
      >
        {hasClips || hasHiddenChips || hasPendingCuts ? (
          <div ref={clipsContentRef} className="relative h-full w-full">
            {hasHiddenChips &&
              hiddenChips!.map((chip) => (
                <HiddenSegmentChip
                  key={chip.id}
                  positionFraction={
                    durationInSeconds! > 0 ? chip.atCutTime / durationInSeconds! : 0
                  }
                  sourceDuration={chip.sourceDuration}
                  cutReason={chip.cutReason}
                  onRestore={() => onRestoreHidden?.(chip.id)}
                  onDelete={() => onDeleteHidden?.(chip.id)}
                />
              ))}
            {/* Pending-cut overlays (review phase). Translucent red strikes
                over the clip body at the proposed source-time ranges. They sit
                ABOVE the clip with pointer-events disabled so the underlying
                clip stays draggable. */}
            {hasPendingCuts &&
              pendingCuts!.map((cut, i) => {
                const left = (cut.from / durationInSeconds!) * 100;
                const width = ((cut.to - cut.from) / durationInSeconds!) * 100;
                return (
                  <div
                    key={`pending-${i}`}
                    className="absolute top-0 h-full pointer-events-none z-[5]"
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 0.4)}%`,
                      backgroundColor: 'rgba(239,68,68,0.45)',
                      borderLeft: '1px solid rgba(239,68,68,0.9)',
                      borderRight: '1px solid rgba(239,68,68,0.9)',
                      mixBlendMode: 'normal',
                    }}
                    title={`Proposed ${cut.type} · ${cut.from.toFixed(2)}–${cut.to.toFixed(2)}s${cut.reason ? ` — ${cut.reason}` : ''}`}
                  />
                );
              })}
            {hasClips && clips!.map((clip) => {
              const left = (clip.startTime / durationInSeconds) * 100;
              const width = ((clip.endTime - clip.startTime) / durationInSeconds) * 100;
              const isDragging = draggingClipId === clip.id;
              const isTrimming = trimmingClip?.id === clip.id;
              // Primary selection drives the editor panels; every selected clip
              // (incl. the primary) gets a highlight ring.
              const isPrimary = selectedClipId === clip.id;
              const isSelected = isPrimary || (selectedClipIds?.has(clip.id) ?? false);
              const isPending = clip.isPending === true;
              const interactive = onMoveClip || onSelectClip;
              // Pending placeholders use a transparent fill + dashed outline so
              // they read as "planned, not yet generated" — distinct from
              // solid generated clips on the same track.
              const pendingBg = isPending
                ? 'transparent'
                : track.color;
              return (
                <div
                  key={clip.id}
                  className={`absolute top-0 h-full rounded-[2px] flex items-center px-[3px] overflow-hidden select-none ${
                    onMoveClip ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    backgroundColor: pendingBg,
                    opacity: isDragging || isTrimming || isSelected
                      ? 1
                      : isPending
                        ? 0.7
                        : 0.85,
                    border: isPending
                      ? `1px dashed ${track.color}`
                      : undefined,
                    boxShadow:
                      isPrimary
                        ? '0 0 0 2px var(--color-accent), 0 0 0 3px rgba(0,0,0,0.4)'
                        : isSelected
                          ? '0 0 0 1.5px var(--color-accent)'
                          : isDragging || isTrimming
                            ? '0 0 0 1px var(--color-accent)'
                            : undefined,
                  }}
                  title={isPending ? `${clip.title} · pending — click to edit & generate` : clip.title}
                  onMouseDown={interactive ? (e) => handleClipDragStart(e, clip) : undefined}
                  onContextMenu={
                    onClipContextMenu
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onClipContextMenu(clip.id, e.clientX, e.clientY);
                        }
                      : undefined
                  }
                >
                  {clip.waveform && !hideWaveform && !isPending && !clip.muted && (
                    <ClipWaveform
                      url={clip.waveform.url}
                      inPointSeconds={clip.waveform.inPointSeconds}
                      durationSeconds={clip.waveform.durationSeconds}
                    />
                  )}
                  {onTrimClip && (
                    <div
                      className="absolute left-0 top-0 h-full w-[6px] cursor-ew-resize z-10"
                      style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
                      onMouseDown={(e) => handleClipTrimStart(e, clip, 'start')}
                    />
                  )}
                  {clip.muted && (
                    <span
                      className="relative z-[1] shrink-0 mr-[3px] pointer-events-none flex items-center"
                      style={{ color: 'white', opacity: 0.95 }}
                      title="Audio muted"
                    >
                      <svg width={10} height={10} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 5.5V8.5H4L7 11V3L4 5.5H2Z" fill="currentColor" />
                        <path d="M9.5 5L12.5 8M12.5 5L9.5 8" />
                      </svg>
                    </span>
                  )}
                  {!hideFileNames && (
                    <span
                      className="relative z-[1] text-[8px] font-medium truncate pointer-events-none"
                      style={{
                        color: isPending ? track.color : 'white',
                        textShadow: clip.waveform && !hideWaveform ? '0 1px 2px rgba(0,0,0,0.6)' : undefined,
                      }}
                    >
                      {clip.title}
                    </span>
                  )}
                  {onTrimClip && (
                    <div
                      className="absolute right-0 top-0 h-full w-[6px] cursor-ew-resize z-10"
                      style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
                      onMouseDown={(e) => handleClipTrimStart(e, clip, 'end')}
                    />
                  )}
                  {/* Transition wedges — a small corner triangle at the edge
                      that has an entrance (left) or exit (right) transition.
                      pointer-events disabled so they don't block clip drags. */}
                  {clip.transitionIn && (
                    <div
                      className="absolute pointer-events-none z-10"
                      style={{
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 0,
                        height: 0,
                        borderTop: '20px solid rgba(255,255,255,0.55)',
                        borderRight: '8px solid transparent',
                      }}
                      title="Entrance transition"
                    />
                  )}
                  {clip.transitionOut && (
                    <div
                      className="absolute pointer-events-none z-10"
                      style={{
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 0,
                        height: 0,
                        borderBottom: '20px solid rgba(255,255,255,0.55)',
                        borderLeft: '8px solid transparent',
                      }}
                      title="Exit transition"
                    />
                  )}
                  {/* Override indicator — small dot top-right corner. Used by
                      caption clips today; pointer-events disabled so it doesn't
                      block drag interactions on the clip body. */}
                  {clip.hasOverride && (
                    <div
                      className="absolute pointer-events-none z-10"
                      style={{
                        top: 2,
                        right: 2,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(239,159,39,1)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                      }}
                      title="This segment has overrides"
                    />
                  )}

                  {/* Animation arrows — drawn on the PRIMARY-selected clip as
                      draggable bands. Each is a slanted line (a Camtasia-style
                      "animate" arrow) with edge handles to retime it. Positioned
                      in clip-local space (startSeconds/durationSeconds over the
                      clip's own length). */}
                  {isPrimary && onUpdateAnimation && clip.animations?.map((anim) => {
                    const clipDur = clip.endTime - clip.startTime;
                    if (clipDur <= 0) return null;
                    const aLeft = Math.max(0, Math.min(100, (anim.startSeconds / clipDur) * 100));
                    const aWidth = Math.max(
                      0,
                      Math.min(100 - aLeft, (anim.durationSeconds / clipDur) * 100)
                    );
                    const animSelected = selectedAnimationId === anim.id;
                    const animActive = interactingAnimId === anim.id;
                    return (
                      <div
                        key={`anim-${anim.id}`}
                        className="absolute z-20 cursor-grab"
                        style={{
                          left: `${aLeft}%`,
                          width: `${aWidth}%`,
                          minWidth: 16,
                          top: '50%',
                          height: 12,
                          transform: 'translateY(-50%)',
                          borderRadius: 3,
                          backgroundColor:
                            animSelected || animActive
                              ? 'rgba(255,255,255,0.34)'
                              : 'rgba(255,255,255,0.18)',
                          border: animSelected
                            ? '1px solid var(--color-accent)'
                            : '1px solid rgba(255,255,255,0.55)',
                        }}
                        title={`${anim.label} · ${anim.durationSeconds.toFixed(2)}s`}
                        onMouseDown={(e) => handleAnimMoveStart(e, clip, anim)}
                      >
                        {/* Slanted "animate" arrow line (stroke stays crisp under
                            the band's non-uniform stretch). */}
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          preserveAspectRatio="none"
                          viewBox="0 0 100 100"
                        >
                          <line
                            x1="6"
                            y1="90"
                            x2="94"
                            y2="12"
                            stroke="white"
                            strokeOpacity="0.85"
                            strokeWidth="1.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                        <div
                          className="absolute left-0 top-0 h-full w-[6px] cursor-ew-resize"
                          style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '3px 0 0 3px' }}
                          onMouseDown={(e) => handleAnimTrimStart(e, clip, anim, 'start')}
                        />
                        <div
                          className="absolute right-0 top-0 h-full w-[6px] cursor-ew-resize"
                          style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '0 3px 3px 0' }}
                          onMouseDown={(e) => handleAnimTrimStart(e, clip, anim, 'end')}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="h-full w-full rounded-[3px]"
            style={{
              border: '1px dashed var(--color-border)',
              opacity: 0.4,
            }}
          />
        )}
      </div>
    </div>
  );
}
