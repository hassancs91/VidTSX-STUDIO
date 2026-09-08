// Folding the run stream into a chat list, as pure functions (agents plan §6).
//
// The same shape `useStudioAgent` uses, extracted so it can be reasoned about
// (and later tested) without a React tree: every fold takes the list and one
// event and returns a new list. The hook only decides WHEN to call them.

import type { AgentArtifact } from '@shared/types/agents';
import type { AgentChatRow } from '../types';

/** Friendly labels for the wave-1 tools; unknown ids show their raw name. */
export const AGENT_TOOL_LABELS: Record<string, string> = {
  write_document: 'Writing a document',
  generate_composition: 'Creating a composition',
  edit_composition: 'Editing the composition',
  render_composition: 'Queueing a render',
  generate_image: 'Generating an image',
  generate_video: 'Generating video',
  ask_user: 'Asking you something',
  list_artifacts: 'Reviewing what it has made',
};

let seq = 0;
export function chatRowId(): string {
  seq += 1;
  return `row-${Date.now().toString(36)}-${seq}`;
}

/** Replace the trailing pending row, or leave the list alone when none is open. */
export function patchPending(
  rows: AgentChatRow[],
  patch: (row: AgentChatRow) => AgentChatRow,
): AgentChatRow[] {
  const last = rows[rows.length - 1];
  if (!last || !last.pending) return rows;
  return [...rows.slice(0, -1), patch(last)];
}

export function appendDelta(rows: AgentChatRow[], text: string): AgentChatRow[] {
  return patchPending(rows, (row) => ({ ...row, text: row.text + text }));
}

/**
 * A tool call starts a NEW model turn, so the streamed text restarts: deltas
 * that follow belong to the reply after the tool result, not to the sentence
 * that was interrupted.
 */
export function appendToolCall(
  rows: AgentChatRow[],
  tool: string,
  detail?: string,
): AgentChatRow[] {
  return patchPending(rows, (row) => ({
    ...row,
    text: '',
    toolCalls: [...(row.toolCalls ?? []), { tool, ...(detail ? { detail } : {}) }],
  }));
}

export function noteOnPending(rows: AgentChatRow[], note: string): AgentChatRow[] {
  return patchPending(rows, (row) => ({ ...row, note }));
}

/** Start a turn: the user's message, then the assistant row deltas land in. */
export function startTurn(rows: AgentChatRow[], prompt: string): AgentChatRow[] {
  return [
    ...rows,
    { id: chatRowId(), role: 'user', text: prompt },
    { id: chatRowId(), role: 'assistant', text: '', pending: true },
  ];
}

export function finishTurn(
  rows: AgentChatRow[],
  outcome: { text?: string; error?: string },
): AgentChatRow[] {
  return patchPending(rows, (row) => ({
    ...row,
    pending: false,
    ...(outcome.error
      ? { text: outcome.error, error: true }
      : { text: outcome.text ?? row.text }),
  }));
}

/** Append or replace by id — `artifact-updated` carries the whole record. */
export function mergeArtifact(
  artifacts: AgentArtifact[],
  artifact: AgentArtifact,
): AgentArtifact[] {
  const index = artifacts.findIndex((a) => a.id === artifact.id);
  if (index === -1) return [...artifacts, artifact];
  const next = [...artifacts];
  next[index] = artifact;
  return next;
}

/**
 * What the stage should show: the newest artifact that has something to look
 * at. A `job` is skipped once it has produced its result, because the result is
 * the more interesting artifact and arrives immediately after it.
 */
export function preferredArtifactId(artifacts: AgentArtifact[]): string | null {
  for (let i = artifacts.length - 1; i >= 0; i -= 1) {
    const artifact = artifacts[i];
    if (artifact.kind === 'job' && artifact.payload.resultArtifactId) continue;
    return artifact.id;
  }
  return null;
}
