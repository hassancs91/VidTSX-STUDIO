import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, LockOpen, MoreVertical, Volume2, VolumeX } from 'lucide-react';
import type { StudioTrack } from '../../types';
import type { TimelineAction } from '../../hooks/useTimeline';
import { TRACK_HEIGHT } from '../../services/timeline-view';
import { trackMenuItems } from '../../services/track-menu';
import { FloatingMenu } from './FloatingMenu';

interface Props {
  track: StudioTrack;
  /** Position within the lane stack, for the move up/down menu items. */
  index: number;
  trackCount: number;
  selected: boolean;
  onSelect: (trackId: string | null) => void;
  dispatch: React.Dispatch<TimelineAction>;
  /** The lane-background context menu picked Rename for this track — open the
   *  inline editor here (the input lives in the header, not the lane). */
  renameRequested: boolean;
  onRenameRequestHandled: () => void;
}

/**
 * Fixed left column cell for one lane. Click chooses the track (pool-adds
 * land on the chosen track), the icons toggle lock and mute/hide, and the
 * kebab button OR right-click opens rename/reorder/delete. Double-click the
 * name to rename.
 */
export function TrackHeader({
  track,
  index,
  trackCount,
  selected,
  onSelect,
  dispatch,
  renameRequested,
  onRenameRequestHandled,
}: Props) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const kebabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!renameRequested) return;
    setEditing(true);
    onRenameRequestHandled();
  }, [renameRequested, onRenameRequestHandled]);

  const toggleFlag = (flag: 'locked' | 'muted' | 'hidden', value: boolean) =>
    dispatch({ type: 'track-flag', trackId: track.id, flag, value });

  const MutedIcon = track.muted ? VolumeX : Volume2;
  const HiddenIcon = track.hidden ? EyeOff : Eye;
  const LockIcon = track.locked ? Lock : LockOpen;

  return (
    <div
      className={`group flex items-center gap-1 px-1.5 cursor-default ${
        selected ? 'bg-app-active' : 'hover:bg-app-hover'
      }`}
      style={{ height: TRACK_HEIGHT, borderBottom: '0.5px solid var(--color-border)' }}
      title={`${track.name} (${track.kind}) — click to choose, right-click for options`}
      onClick={() => onSelect(selected ? null : track.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onSelect(track.id);
        setMenuAt({ x: e.clientX, y: e.clientY });
      }}
    >
      {editing ? (
        <RenameInput
          initial={track.name}
          onDone={(name) => {
            setEditing(false);
            if (name !== null) dispatch({ type: 'track-rename', trackId: track.id, name });
          }}
        />
      ) : (
        <span
          className={`text-[10px] font-medium flex-1 truncate ${
            selected ? 'text-accent-light' : 'text-text-muted'
          }`}
          onDoubleClick={() => setEditing(true)}
        >
          {track.name}
        </span>
      )}

      <HeaderToggle
        label={track.locked ? `Unlock ${track.name}` : `Lock ${track.name} (blocks edits)`}
        active={Boolean(track.locked)}
        onClick={() => toggleFlag('locked', !track.locked)}
      >
        <LockIcon size={10} strokeWidth={1.5} />
      </HeaderToggle>
      {track.kind === 'audio' ? (
        <HeaderToggle
          label={track.muted ? `Unmute ${track.name}` : `Mute ${track.name}`}
          active={Boolean(track.muted)}
          onClick={() => toggleFlag('muted', !track.muted)}
        >
          <MutedIcon size={11} strokeWidth={1.5} />
        </HeaderToggle>
      ) : (
        <HeaderToggle
          label={track.hidden ? `Show ${track.name}` : `Hide ${track.name} (drops its picture)`}
          active={Boolean(track.hidden)}
          onClick={() => toggleFlag('hidden', !track.hidden)}
        >
          <HiddenIcon size={11} strokeWidth={1.5} />
        </HeaderToggle>
      )}
      {/* Always-reachable entry to the same menu as right-click — the menu was
          effectively invisible when right-click was the only way in. */}
      <button
        ref={kebabRef}
        title={`${track.name} options`}
        aria-label={`${track.name} options`}
        onClick={(e) => {
          e.stopPropagation();
          const rect = kebabRef.current?.getBoundingClientRect();
          setMenuAt(rect ? { x: rect.left, y: rect.bottom + 2 } : { x: e.clientX, y: e.clientY });
        }}
        className={`flex items-center justify-center w-[16px] h-[16px] rounded-[4px] transition-colors ${
          menuAt
            ? 'text-text-secondary'
            : 'text-text-ghost opacity-0 group-hover:opacity-100 hover:text-text-secondary'
        }`}
      >
        <MoreVertical size={11} strokeWidth={1.5} />
      </button>

      {menuAt && (
        <FloatingMenu
          x={menuAt.x}
          y={menuAt.y}
          items={trackMenuItems(track, index, trackCount)}
          onPick={(id) => {
            if (id === 'rename') setEditing(true);
            else if (id === 'up') dispatch({ type: 'track-move', trackId: track.id, direction: -1 });
            else if (id === 'down') dispatch({ type: 'track-move', trackId: track.id, direction: 1 });
            else if (id === 'delete') dispatch({ type: 'track-remove', trackId: track.id });
          }}
          onClose={() => setMenuAt(null)}
        />
      )}
    </div>
  );
}

function HeaderToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center justify-center w-[16px] h-[16px] rounded-[4px] transition-colors ${
        active ? 'text-accent-light' : 'text-text-ghost hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

/** Inline rename: Enter/blur commits, Escape cancels (null). */
function RenameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (name: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value);
        else if (e.key === 'Escape') onDone(null);
        e.stopPropagation();
      }}
      onBlur={() => onDone(value)}
      className="flex-1 min-w-0 h-[18px] px-1 text-[10px] rounded-[3px] bg-app-base text-text-primary outline-none"
      style={{ border: '0.5px solid var(--color-accent)' }}
    />
  );
}
