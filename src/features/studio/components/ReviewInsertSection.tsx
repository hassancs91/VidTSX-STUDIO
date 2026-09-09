// Inspector card for an open insert-plan proposal (W3 `insert_asset`): the
// one clip the agent wants to place — which asset, which lane, where — with
// the same accept/reject, preview-result and one-undo-step Apply the cuts and
// shots reviews have. Apply is the only way it reaches the timeline unless
// the user told the agent to apply it (accept_proposal drives this same
// dispatch).

import { Button } from '@shared/components/Button';
import type { StudioMediaAsset, StudioProposal, StudioProposalItem, StudioTimeline } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import { insertItemPlacement } from '../services/apply-insert-proposal';

interface Props {
  proposal: StudioProposal;
  assets: StudioMediaAsset[];
  timeline: StudioTimeline;
  selectedCutId: string | null;
  dispatch: React.Dispatch<TimelineAction>;
  /** Select the item and park the playhead where it would land. */
  onSelectItem: (item: StudioProposalItem) => void;
  /** Audition the clip in place (preview-result timeline, 1× pinned). */
  onPlayItem: (item: StudioProposalItem) => void;
  previewResult: boolean;
  onTogglePreviewResult: () => void;
  onApplied: (summary: string) => void;
}

function formatTc(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

const LANE_LABEL: Record<string, string> = { broll: 'b-roll', overlay: 'overlay', audio: 'audio' };
const LANE_STYLE: Record<string, string> = {
  broll: 'bg-accent/20 text-accent-light',
  overlay: 'bg-accent-blue/15 text-accent-blue',
  audio: 'bg-emerald-500/15 text-emerald-500',
};

export function ReviewInsertSection({
  proposal,
  assets,
  timeline,
  selectedCutId,
  dispatch,
  onSelectItem,
  onPlayItem,
  previewResult,
  onTogglePreviewResult,
  onApplied,
}: Props) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const acceptedCount = proposal.items.filter((i) => i.status === 'accepted').length;
  const noteLines = (proposal.agentNote ?? '').split('\n').filter(Boolean);

  return (
    <div className="flex flex-col gap-2" data-review-insert>
      {noteLines.length > 0 && (
        <div className="text-[11px] text-text-secondary leading-snug">{noteLines[0]}</div>
      )}

      <label className="flex items-center gap-2 text-[11px] text-text-secondary cursor-pointer select-none">
        <input type="checkbox" checked={previewResult} onChange={onTogglePreviewResult} />
        Preview result (play as if the clip were placed)
      </label>

      <div
        className="flex flex-col rounded-[6px] overflow-hidden"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        {proposal.items.map((item) => {
          const asset = item.insert ? byId.get(item.insert.assetId) : undefined;
          const name = asset ? (asset.path.split(/[\\/]/).pop() ?? asset.id) : (item.insert?.assetId ?? '—');
          const lane = item.insert?.lane ?? 'broll';
          const at = insertItemPlacement(timeline, item);
          const rejected = item.status === 'rejected';
          return (
            <div
              key={item.id}
              className={`flex gap-2 px-2 py-[6px] cursor-pointer transition-colors ${
                item.id === selectedCutId ? 'bg-app-active' : 'hover:bg-app-hover'
              } ${rejected ? 'opacity-50' : ''}`}
              style={{ borderBottom: '0.5px solid var(--color-border)' }}
              onClick={() => onSelectItem(item)}
              data-insert-item={item.insert?.assetId}
            >
              <input
                type="checkbox"
                className="mt-[2px] shrink-0"
                checked={!rejected}
                onClick={(e) => e.stopPropagation()}
                onChange={() =>
                  dispatch({
                    type: 'proposal-item-status',
                    proposalId: proposal.id,
                    itemId: item.id,
                    status: rejected ? 'accepted' : 'rejected',
                  })
                }
                title={rejected ? 'Rejected — not placed' : 'Accepted — will be placed'}
              />
              <div className="flex flex-col gap-[2px] min-w-0 flex-1">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[10px] text-text-primary truncate">{name}</span>
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full ${LANE_STYLE[lane] ?? 'bg-app-active text-text-secondary'}`}
                  >
                    {LANE_LABEL[lane] ?? lane}
                  </span>
                  <span className="ml-auto text-[10px] text-text-dim tabular-nums">
                    {item.duration !== undefined ? `${item.duration.toFixed(1)} s` : ''}
                  </span>
                </div>
                <div className="text-[10px] text-text-muted truncate">
                  {at !== null
                    ? `at ${formatTc(at)} (timeline)${item.sourceStart !== undefined ? ' — anchored to the footage' : ''}`
                    : 'anchor is no longer on the timeline — cannot place'}
                </div>
                {item.note && <div className="text-[10px] text-text-dim truncate">{item.note}</div>}
                {!asset && (
                  <div className="text-[10px] text-accent-red truncate">Asset missing from the project</div>
                )}
                <div className="flex gap-3">
                  <button
                    className="text-[10px] text-accent-blue hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayItem(item);
                    }}
                    title="Play the clip in place, as if placed"
                  >
                    ▶ Preview clip
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={acceptedCount === 0}
          onClick={() => {
            dispatch({ type: 'proposal-apply', proposalId: proposal.id });
            onApplied(`Placed ${acceptedCount} clip${acceptedCount === 1 ? '' : 's'} on the timeline`);
          }}
        >
          Place {acceptedCount} clip{acceptedCount === 1 ? '' : 's'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => dispatch({ type: 'proposal-reject', proposalId: proposal.id })}
        >
          Reject
        </Button>
      </div>
      <p className="text-[10px] text-text-dim leading-snug">
        The clip lands on its own lane over the footage (or an audio lane) and never moves what
        is already there. Apply is one undo step.
      </p>
    </div>
  );
}
