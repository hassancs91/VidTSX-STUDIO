import { useEffect, useState } from 'react';
import {
  FoldHorizontal,
  Magnet,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { formatClock } from '../../services/timeline-view';

interface Props {
  /** Playhead feed — see usePlayback: the clock re-renders itself, not the panel. */
  subscribe: (listener: (seconds: number) => void) => () => void;
  durationSeconds: number;
  fps: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  snapEnabled: boolean;
  rippleEnabled: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onToggleRipple: () => void;
  onToggleSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function TimelineToolbar({
  subscribe,
  durationSeconds,
  fps,
  canUndo,
  canRedo,
  hasSelection,
  snapEnabled,
  rippleEnabled,
  canZoomIn,
  canZoomOut,
  onUndo,
  onRedo,
  onSplit,
  onDelete,
  onToggleRipple,
  onToggleSnap,
  onZoomIn,
  onZoomOut,
}: Props) {
  return (
    <div
      className="flex items-center gap-1 h-[30px] px-2 shrink-0 bg-app-deep"
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
    >
      <Clock subscribe={subscribe} fps={fps} />
      <span className="text-[10px] font-mono text-text-ghost tabular-nums">
        / {formatClock(durationSeconds, fps)}
      </span>

      <Divider />

      <ToolButton label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={13} strokeWidth={1.5} />
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={13} strokeWidth={1.5} />
      </ToolButton>

      <Divider />

      <ToolButton label="Split at playhead (S)" onClick={onSplit}>
        <Scissors size={13} strokeWidth={1.5} />
      </ToolButton>
      <ToolButton
        label={
          rippleEnabled
            ? 'Delete and close the gap (Delete)'
            : 'Delete, leaving the gap (Delete)'
        }
        onClick={onDelete}
        disabled={!hasSelection}
      >
        <Trash2 size={13} strokeWidth={1.5} />
      </ToolButton>
      <ToolButton
        label="Auto ripple — deleting closes the gap (Backspace always leaves it)"
        onClick={onToggleRipple}
        active={rippleEnabled}
      >
        <FoldHorizontal size={13} strokeWidth={1.5} />
      </ToolButton>

      <div className="flex-1" />

      <ToolButton label="Snap to edges and playhead" onClick={onToggleSnap} active={snapEnabled}>
        <Magnet size={13} strokeWidth={1.5} />
      </ToolButton>
      <ToolButton label="Zoom out (Ctrl+scroll)" onClick={onZoomOut} disabled={!canZoomOut}>
        <ZoomOut size={13} strokeWidth={1.5} />
      </ToolButton>
      <ToolButton label="Zoom in (Ctrl+scroll)" onClick={onZoomIn} disabled={!canZoomIn}>
        <ZoomIn size={13} strokeWidth={1.5} />
      </ToolButton>
    </div>
  );
}

/** Isolated so playback repaints one <span>, not the whole timeline panel. */
function Clock({
  subscribe,
  fps,
}: {
  subscribe: (listener: (seconds: number) => void) => () => void;
  fps: number;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let raf = 0;
    let latest = 0;
    let queued = false;
    const flush = () => {
      queued = false;
      setSeconds(latest);
    };
    const unsubscribe = subscribe((value) => {
      latest = value;
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(flush);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [subscribe]);

  return (
    <span className="text-[11px] font-mono text-text-secondary tabular-nums">
      {formatClock(seconds, fps)}
    </span>
  );
}

function Divider() {
  return <div className="w-px h-[14px] mx-1 bg-[var(--color-border)]" />;
}

function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center w-[24px] h-[22px] rounded-[5px] transition-colors disabled:opacity-30 disabled:cursor-default ${
        active
          ? 'bg-app-active text-accent-light'
          : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
