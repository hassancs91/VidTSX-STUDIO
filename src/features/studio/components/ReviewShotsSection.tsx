// Inspector list for an open shot-plan proposal (D10): every generated shot
// with accept/reject toggles, anchor readout, and a "Preview shot" audition
// (scratch-apply + park, the cuts pattern). Apply inserts the accepted shots
// as ONE undoable transaction; Reject all closes the proposal and drops the
// registry entries (files stay on disk).

import { Button } from '@shared/components/Button';
import type { StudioProposal, StudioProposalItem, StudioShot } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';

interface Props {
  proposal: StudioProposal;
  shots: StudioShot[];
  selectedCutId: string | null;
  dispatch: React.Dispatch<TimelineAction>;
  /** Select the item and park the playhead where it would land. */
  onSelectItem: (item: StudioProposalItem) => void;
  /** Audition the shot in place (preview-result timeline, 1× pinned). */
  onPlayShot: (item: StudioProposalItem) => void;
  previewResult: boolean;
  onTogglePreviewResult: () => void;
  onApplied: (summary: string) => void;
}

function formatTc(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

const KIND_STYLE: Record<string, string> = {
  cutaway: 'bg-accent/20 text-accent-light',
  overlay: 'bg-accent-blue/15 text-accent-blue',
  title: 'bg-amber-500/15 text-amber-500',
};

export function ReviewShotsSection({
  proposal,
  shots,
  selectedCutId,
  dispatch,
  onSelectItem,
  onPlayShot,
  previewResult,
  onTogglePreviewResult,
  onApplied,
}: Props) {
  const byId = new Map(shots.map((s) => [s.id, s]));
  const acceptedCount = proposal.items.filter((i) => i.status === 'accepted').length;
  const rejectedCount = proposal.items.filter((i) => i.status === 'rejected').length;
  const noteLines = (proposal.agentNote ?? '').split('\n').filter(Boolean);

  return (
    <div className="flex flex-col gap-2" data-review-shots>
      {noteLines.length > 0 && (
        <div className="text-[11px] text-text-secondary leading-snug">{noteLines[0]}</div>
      )}
      <div className="text-[10px] text-text-dim tabular-nums">
        {proposal.items.length} shot{proposal.items.length === 1 ? '' : 's'} proposed
      </div>

      <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer select-none">
        <input type="checkbox" checked={previewResult} onChange={onTogglePreviewResult} />
        Preview result (play as if the accepted shots were placed)
      </label>

      <div
        className="flex flex-col rounded-[6px] overflow-hidden"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        {proposal.items.map((item) => (
          <ShotItemRow
            key={item.id}
            item={item}
            shot={item.shotId ? (byId.get(item.shotId) ?? null) : null}
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
            onPlay={() => onPlayShot(item)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={acceptedCount === 0}
          onClick={() => {
            dispatch({ type: 'proposal-apply', proposalId: proposal.id });
            onApplied(
              `Placed ${acceptedCount} shot${acceptedCount === 1 ? '' : 's'} on the timeline`,
            );
          }}
        >
          Place {acceptedCount} shot{acceptedCount === 1 ? '' : 's'}
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
        Everything starts accepted — untick the shots you don&rsquo;t want placed (they stay in
        the pool). Reject all removes them from the pool too; the generated files stay on disk.
        Apply is one undo step.
      </p>
    </div>
  );
}

function ShotItemRow({
  item,
  shot,
  selected,
  onToggle,
  onSelect,
  onPlay,
}: {
  item: StudioProposalItem;
  shot: StudioShot | null;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onPlay: () => void;
}) {
  const rejected = item.status === 'rejected';
  const kind = shot?.kind ?? item.mode ?? 'overlay';
  const seconds =
    item.duration ??
    (shot?.config ? shot.config.durationInFrames / shot.config.fps : undefined);
  const broken = shot === null || shot.status !== 'ready';

  return (
    <div
      className={`flex gap-2 px-2 py-[6px] cursor-pointer transition-colors ${
        selected ? 'bg-app-active' : 'hover:bg-app-hover'
      } ${rejected ? 'opacity-50' : ''}`}
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
      onClick={onSelect}
      data-shot-item={item.shotId}
    >
      <input
        type="checkbox"
        className="mt-[2px] shrink-0"
        checked={!rejected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        title={rejected ? 'Rejected — not placed, stays in the pool' : 'Accepted — will be placed'}
      />
      <div className="flex flex-col gap-[2px] min-w-0 flex-1">
        <div className="flex items-center gap-[6px]">
          <span className="text-[10px] text-text-primary truncate">
            {shot?.name ?? item.shotId ?? '—'}
          </span>
          <span
            className={`text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full ${KIND_STYLE[kind] ?? 'bg-app-active text-text-secondary'}`}
          >
            {kind}
          </span>
          <span className="ml-auto text-[10px] text-text-dim tabular-nums">
            {seconds !== undefined ? `${seconds.toFixed(1)} s` : ''}
          </span>
        </div>
        <div className="text-[10px] text-text-muted truncate">
          {item.sourceStart !== undefined && item.sourceEnd !== undefined
            ? `at ${formatTc(item.sourceStart)} – ${formatTc(item.sourceEnd)} (source)`
            : item.timelineStart !== undefined
              ? `at ${formatTc(item.timelineStart)} (timeline)`
              : 'placed in sequence'}
        </div>
        {item.note && <div className="text-[10px] text-text-dim truncate">{item.note}</div>}
        {broken && (
          <div className="text-[10px] text-accent-red truncate">
            {shot ? (shot.error ?? 'Shot is not ready') : 'Shot missing from the pool'}
          </div>
        )}
        <div className="flex gap-3">
          <button
            className="text-[10px] text-accent-blue hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            title="Play the shot in place, with the accepted shots applied"
          >
            ▶ Preview shot
          </button>
        </div>
      </div>
    </div>
  );
}
