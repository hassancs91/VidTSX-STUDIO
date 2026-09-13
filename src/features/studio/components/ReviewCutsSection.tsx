// Inspector list for the open cut proposal: every proposed cut with accept/
// reject toggles, category + adjusted markers, transcript context, and the
// two auditions. The footer commits — Apply runs the accepted cuts as ONE
// undoable transaction, Reject all closes the proposal untouched.

import { useMemo } from 'react';
import { Button } from '@shared/components/Button';
import type { StudioCutCategory, StudioProposal, StudioProposalItem, StudioTimeline } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import { acceptedRemovedSeconds, timelineEndSeconds } from '../services/cut-proposal';
import { applyCutProposal } from '../services/apply-cut-proposal';
import { useRippleMode } from '../hooks/useRippleMode';

interface Props {
  proposal: StudioProposal;
  timeline: StudioTimeline;
  selectedCutId: string | null;
  dispatch: React.Dispatch<TimelineAction>;
  /** Select the item and park the playhead on its region. */
  onSelectItem: (item: StudioProposalItem) => void;
  onPlayRemoved: (item: StudioProposalItem) => void;
  onPlayJoin: (item: StudioProposalItem) => void;
  previewResult: boolean;
  onTogglePreviewResult: () => void;
  onApplied: (summary: string) => void;
}

/** "M:SS.d" — one decimal, because cut edges live under a second. */
function formatTc(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

const CATEGORY_STYLE: Record<string, { label: string; className: string }> = {
  long_pause: { label: 'pause', className: 'bg-amber-500/15 text-amber-500' },
  dead_air: { label: 'dead air', className: 'bg-accent-red/15 text-accent-red' },
  retake: { label: 'retake', className: 'bg-accent/20 text-accent-light' },
  false_start: { label: 'false start', className: 'bg-accent/20 text-accent-light' },
  filler: { label: 'filler', className: 'bg-accent/20 text-accent-light' },
  fluff: { label: 'fluff', className: 'bg-accent/20 text-accent-light' },
  user_cut: { label: 'user cut', className: 'bg-app-active text-text-secondary' },
};

export function ReviewCutsSection({
  proposal,
  timeline,
  selectedCutId,
  dispatch,
  onSelectItem,
  onPlayRemoved,
  onPlayJoin,
  previewResult,
  onTogglePreviewResult,
  onApplied,
}: Props) {
  const acceptedCount = proposal.items.filter((i) => i.status === 'accepted').length;
  const rejectedCount = proposal.items.filter((i) => i.status === 'rejected').length;
  const removed = acceptedRemovedSeconds(proposal);
  const { rippleAllTracks } = useRippleMode();

  // Honest before → after readout: run the real apply on a scratch copy.
  const resultSeconds = useMemo(
    () => timelineEndSeconds(applyCutProposal(timeline, proposal, { rippleAllTracks })),
    [timeline, proposal, rippleAllTracks],
  );
  const beforeSeconds = useMemo(() => timelineEndSeconds(timeline), [timeline]);

  const noteLines = (proposal.agentNote ?? '').split('\n').filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      {noteLines.length > 0 && (
        <div className="text-[11px] text-text-secondary leading-snug">{noteLines[0]}</div>
      )}
      <div className="text-[10px] text-text-dim tabular-nums">
        {proposal.items.length} proposed · −{removed.toFixed(1)} s · {formatTc(beforeSeconds)} →{' '}
        {formatTc(resultSeconds)}
      </div>
      {noteLines.slice(1).map((line, i) => (
        <div key={i} className="text-[10px] text-amber-500/90 leading-snug">
          ⚠ {line}
        </div>
      ))}

      <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer select-none">
        <input type="checkbox" checked={previewResult} onChange={onTogglePreviewResult} />
        Preview result (play as if the accepted cuts were applied)
      </label>

      <div
        className="flex flex-col rounded-[6px] overflow-hidden"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        {proposal.items.map((item) => (
          <CutItemRow
            key={item.id}
            item={item}
            selected={item.id === selectedCutId}
            onToggle={() =>
              dispatch({
                type: 'proposal-item-status',
                proposalId: proposal.id,
                itemId: item.id,
                status: item.status === 'accepted' ? 'rejected' : 'accepted',
              })
            }
            onSelect={() => onSelectItem(item)}
            onPlayRemoved={() => onPlayRemoved(item)}
            onPlayJoin={() => onPlayJoin(item)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={acceptedCount === 0}
          onClick={() => {
            dispatch({ type: 'proposal-apply', proposalId: proposal.id, rippleAllTracks });
            onApplied(
              `Removed ${removed.toFixed(1)} s across ${acceptedCount} cut${
                acceptedCount === 1 ? '' : 's'
              } (${formatTc(beforeSeconds)} → ${formatTc(resultSeconds)})`,
            );
          }}
        >
          Apply {acceptedCount} cut{acceptedCount === 1 ? '' : 's'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => dispatch({ type: 'proposal-reject', proposalId: proposal.id })}
        >
          Reject all
        </Button>
        {rejectedCount > 0 && (
          <span className="ml-auto text-[10px] text-text-dim">{rejectedCount} rejected</span>
        )}
      </div>
      <p className="text-[10px] text-text-dim leading-snug">
        Everything starts accepted — untick the cuts you want to keep in the video. Drag a
        region&rsquo;s edges on the timeline to adjust it. Apply is one undo step.
      </p>
    </div>
  );
}

function CutItemRow({
  item,
  selected,
  onToggle,
  onSelect,
  onPlayRemoved,
  onPlayJoin,
}: {
  item: StudioProposalItem;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onPlayRemoved: () => void;
  onPlayJoin: () => void;
}) {
  const rejected = item.status === 'rejected';
  const gap =
    item.sourceStart !== undefined && item.sourceEnd !== undefined
      ? item.sourceEnd - item.sourceStart
      : 0;
  const category = CATEGORY_STYLE[(item.category ?? '') as StudioCutCategory];

  return (
    <div
      className={`flex gap-2 px-2 py-[6px] cursor-pointer transition-colors ${
        selected ? 'bg-app-active' : 'hover:bg-app-hover'
      } ${rejected ? 'opacity-50' : ''}`}
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
      onClick={onSelect}
    >
      <input
        type="checkbox"
        className="mt-[2px] shrink-0"
        checked={!rejected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        title={rejected ? 'Rejected — stays in the video' : 'Accepted — will be cut'}
      />
      <div className="flex flex-col gap-[2px] min-w-0 flex-1">
        <div className="flex items-center gap-[6px]">
          <span className="text-[10px] text-text-primary tabular-nums">
            {item.sourceStart !== undefined && item.sourceEnd !== undefined
              ? `${formatTc(item.sourceStart)} – ${formatTc(item.sourceEnd)}`
              : '—'}
          </span>
          {category && (
            <span
              className={`text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full ${category.className}`}
            >
              {category.label}
            </span>
          )}
          {item.adjusted && (
            <span className="text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full bg-accent/20 text-accent-light">
              adjusted
            </span>
          )}
          <span className="ml-auto text-[10px] text-text-dim tabular-nums">
            {rejected ? 'kept' : `−${gap.toFixed(1)} s`}
          </span>
        </div>
        {item.note && <div className="text-[10px] text-text-muted truncate">{item.note}</div>}
        {item.text && (
          <div className="text-[10px] text-text-dim truncate" title="Words inside the cut span">
            cuts: &ldquo;{item.text}&rdquo;
          </div>
        )}
        <div className="flex gap-3">
          <button
            className="text-[10px] text-accent-blue hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onPlayRemoved();
            }}
            title="Hear exactly what this cut removes"
          >
            ▶ Play removed
          </button>
          <button
            className="text-[10px] text-accent-blue hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onPlayJoin();
            }}
            title="Hear around the cut with the cut applied"
          >
            ⏵⏴ Play join
          </button>
        </div>
      </div>
    </div>
  );
}
