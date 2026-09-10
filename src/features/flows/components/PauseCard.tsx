import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { InteractionReply } from '@shared/types/agents';
import type { FlowNodeRunState } from '@shared/types/flows';
import { FLOW_PAUSE_TEXT_FIELD, rejectReply } from '@shared/flows/pause-reply';
import { getInteractionCard, type InteractionPreview, type InteractionValues } from '@renderer/components/interactions/registry';
import type { PendingCheckpoint, RunState } from '../hooks/useFlowRun';

interface Props {
  pending: PendingCheckpoint;
  /** The paused node's state — the current text prefills an editable form. */
  node: FlowNodeRunState | undefined;
  artifacts: RunState['artifacts'];
  assetUrls: RunState['assetUrls'];
  busy: boolean;
  onReply: (reply: InteractionReply) => void;
}

/** Candidate previews from what the run already fetched: title, and a url when the item has a picture. */
function previewsFor(pending: PendingCheckpoint, artifacts: RunState['artifacts'], assetUrls: RunState['assetUrls']) {
  const payload = pending.request.payload;
  const candidates = payload.kind === 'pick' ? payload.candidates : payload.kind === 'approve' ? payload.items : [];
  const previews: Record<string, InteractionPreview> = {};
  for (const c of candidates) {
    if (!c.artifactId) continue;
    const artifact = artifacts.find((a) => a.id === c.artifactId);
    if (!artifact) continue;
    const imageUrl = assetUrls[artifact.id]?.[0];
    previews[artifact.id] = { kind: artifact.kind, title: artifact.title, ...(imageUrl ? { imageUrl } : {}) };
  }
  return previews;
}

/** The editable form starts from the node's current text output. */
function initialValuesFor(pending: PendingCheckpoint, node: FlowNodeRunState | undefined): InteractionValues | undefined {
  if (pending.request.payload.kind !== 'form' || !node?.outputs) return undefined;
  const text = Object.values(node.outputs).find((v) => v.kind === 'text' || v.kind === 'number');
  return text ? { [FLOW_PAUSE_TEXT_FIELD]: [String(text.value)] } : undefined;
}

/**
 * A checkpoint in the run form's right pane (flows plan §1.4): the SHARED
 * interaction card for the kind, "Stop run" as its second button, and the
 * one thing an agent card lacks — reject this step and rerun it once with a
 * note (decision 5).
 */
export function PauseCard({ pending, node, artifacts, assetUrls, busy, onReply }: Props) {
  const [note, setNote] = useState('');
  const Card = getInteractionCard(pending.request.payload.kind);
  const previews = useMemo(() => previewsFor(pending, artifacts, assetUrls), [pending, artifacts, assetUrls]);
  const initialValues = useMemo(() => initialValuesFor(pending, node), [pending, node]);
  const requestId = pending.request.id;
  const canRetry = (node?.rejections ?? 0) < 1;

  return (
    <div className="flex flex-col items-center justify-center gap-2 w-full h-full min-h-0" data-pause-card={pending.request.payload.kind}>
      {/* A definite-height column, so the shared card's `max-h-full` resolves
          and its own body scrolls instead of pushing the footer below the fold. */}
      <div className="flex justify-center w-full min-h-0 max-h-full">
        <Card
          key={requestId}
          request={pending.request}
          previews={previews}
          {...(initialValues ? { initialValues } : {})}
          busy={busy}
          restored={pending.restored}
          cancelLabel="Stop run"
          onAnswer={(values) => onReply({ requestId, status: 'answered', values })}
          onCancel={() => onReply({ requestId, status: 'cancelled' })}
        />
      </div>
      <div
        className="flex items-center gap-1.5 w-full max-w-[720px] rounded-[8px] bg-app-surface px-3 py-2"
        style={{ border: '0.5px solid var(--color-border)' }}
        data-pause-retry
      >
        <span className="text-[10px] text-text-dim shrink-0">
          {canRetry ? 'Not right?' : 'A second rejection stops the run.'}
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          placeholder="What to change (appended to the prompt)"
          className="flex-1 min-w-0 h-[24px] rounded-[6px] bg-app-base px-2 text-[11px] text-text-secondary outline-none focus:border-accent"
          style={{ border: '0.5px solid var(--color-border-input)' }}
          data-pause-note
        />
        <button
          type="button"
          onClick={() => onReply(rejectReply(requestId, note))}
          disabled={busy}
          className="flex items-center gap-1 shrink-0 rounded-[6px] px-2 py-1 text-[11px] text-text-secondary hover:bg-app-hover disabled:opacity-40"
          style={{ border: '0.5px solid var(--color-border-hover)' }}
          data-pause-reject
        >
          <RotateCcw size={11} strokeWidth={1.75} />
          {canRetry ? 'Retry with note' : 'Reject and stop'}
        </button>
      </div>
    </div>
  );
}
