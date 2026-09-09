// Pure helpers behind the Assistant chat hook (useStudioAgent): the request
// shape of an asset, the replay window, proposal chips, the W3 review-outcome
// message and the context-usage estimate. No IPC, no React.

import type { StudioAgentAssetInfo } from '@shared/ipc/types';
import type { StudioAgentChatMessage } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioProposal } from '../types';

/**
 * Context budget for the estimate meter. The engine doesn't report real token
 * usage across providers, so this is a deliberate conservative floor (cloud
 * models are 128k+; local models vary). The estimate exists to warn, not bill.
 */
export const CONTEXT_BUDGET_TOKENS = 128_000;
/** System prompt + skill + tool definitions, roughly. */
const BASE_OVERHEAD_TOKENS = 2_000;
/** Takes-view tokens per transcript word (word + timing markup). */
const TOKENS_PER_TRANSCRIPT_WORD = 2;

/**
 * Replay cap (SHOT_QUALITY_DESIGN.md Q1d, N=30): the UI keeps the whole
 * persisted transcript, but a turn replays only the most recent 30 exchanges
 * (user + assistant pairs). Append-only history keeps the prompt cache warm;
 * a rolling summary would invalidate the prefix every turn.
 */
const REPLAY_TURN_CAP = 30;
const REPLAY_MESSAGE_CAP = REPLAY_TURN_CAP * 2;

/** The marker a multi-step run ends its message with while a card is open
 *  (the prompt's rule): `[next: …]` on the last line. Its presence is what
 *  makes a review outcome re-enter the chat automatically. */
const NEXT_STEP_MARKER = /\[next:\s*[^\]]+\]\s*$/i;

export interface AgentContextUsage {
  /** Estimated tokens the NEXT turn will carry (transcripts + chat + base). */
  estTokens: number;
  /** estTokens over the assumed budget, uncapped (can exceed 1). */
  ratio: number;
}

/** Display row = the persisted shape (Q1d) plus the live-stream flag. */
export interface AgentChatMessage extends StudioAgentChatMessage {
  pending?: boolean;
}

/** The replayed window: newest messages, capped, errors and blanks dropped. */
export function replayWindow(messages: AgentChatMessage[]): AgentChatMessage[] {
  return messages
    .filter((m) => !m.error && m.text.trim().length > 0)
    .slice(-REPLAY_MESSAGE_CAP);
}

export function assetName(asset: StudioMediaAsset): string {
  return asset.path.split(/[\\/]/).pop() ?? asset.id;
}

export function toAgentAsset(asset: StudioMediaAsset): StudioAgentAssetInfo {
  const ready = asset.transcript?.status === 'ready';
  return {
    id: asset.id,
    name: assetName(asset),
    kind: asset.kind,
    path: asset.path,
    ...(asset.description ? { description: asset.description } : {}),
    durationSeconds: asset.probe.duration,
    ...(ready && asset.transcript
      ? {
          transcript: {
            engine: asset.transcript.engine,
            ...(asset.transcript.wordCount !== undefined
              ? { wordCount: asset.transcript.wordCount }
              : {}),
            ...(asset.transcript.features?.verbatimDisfluencies !== undefined
              ? { verbatim: asset.transcript.features.verbatimDisfluencies }
              : {}),
          },
        }
      : {}),
  };
}

/** The chip under an assistant row once its turn produced a proposal. */
export function proposalNoteFor(proposal: StudioProposal): string {
  const n = proposal.items.length;
  if (proposal.kind === 'shot-plan') {
    return `Proposed ${n} shot${n === 1 ? '' : 's'} — review in the Inspector`;
  }
  if (proposal.kind === 'insert-plan') {
    return 'Proposed a clip to place — review in the Inspector';
  }
  return `Proposed ${n} cut${n === 1 ? '' : 's'} — review on the timeline or in the Inspector`;
}

const KIND_LABEL: Record<StudioProposal['kind'], string> = {
  'cut-plan': 'cuts',
  'shot-plan': 'shots',
  'insert-plan': 'insert',
  'sfx-plan': 'sound',
};

/** True when the assistant's message ended with the `[next: …]` marker. */
export function hasNextStepMarker(text: string): boolean {
  return NEXT_STEP_MARKER.test(text.trim());
}

/**
 * The turn the editor sends on the user's behalf when a review card closes
 * during a multi-step run (W3). Null while the proposal is still open.
 */
export function reviewOutcomeMessage(proposal: StudioProposal): string | null {
  if (proposal.status === 'proposed') return null;
  const total = proposal.items.length;
  const accepted = proposal.items.filter((i) => i.status === 'accepted').length;
  const label = KIND_LABEL[proposal.kind] ?? proposal.kind;
  const outcome =
    proposal.status === 'rejected'
      ? `Review outcome: I rejected the ${label} proposal (nothing applied).`
      : `Review outcome: I applied the ${label} proposal — ${accepted} of ${total} item${total === 1 ? '' : 's'} accepted.`;
  return `${outcome} Continue with the next step.`;
}

/**
 * Every turn is a fresh run: the agent re-reads ready transcripts via tools
 * and carries the chat text as history — so those two are what grow the
 * context. chars/4 is the usual rough token heuristic. Only the REPLAYED
 * window counts (Q1d): a long persisted transcript beyond the cap is never
 * sent, so it must not inflate the warning.
 */
export function estimateContextUsage(
  messages: AgentChatMessage[],
  assets: StudioMediaAsset[],
): AgentContextUsage {
  const historyChars = replayWindow(messages).reduce((n, m) => n + m.text.length, 0);
  const transcriptWords = assets.reduce(
    (n, a) => n + (a.transcript?.status === 'ready' ? (a.transcript.wordCount ?? 0) : 0),
    0,
  );
  const estTokens =
    BASE_OVERHEAD_TOKENS + Math.ceil(historyChars / 4) + transcriptWords * TOKENS_PER_TRANSCRIPT_WORD;
  return { estTokens, ratio: estTokens / CONTEXT_BUDGET_TOKENS };
}
