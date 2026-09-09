// Shared contract for the Studio agent's tool groups (V1 completion plan
// §2.3). Every group file exports one `build*Tools(ctx)` that returns the
// typed SDK tool definitions for its group; `index.ts` assembles the server.
// The per-turn state lives on the context so groups can share the
// "one proposal per turn" discipline without a module singleton.

import type { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { StudioAgentEvent, StudioAgentSendRequest } from '../../../../shared/ipc/types/studio';
import type { StudioShot } from '../../../../shared/types/studio';
import { loadProject } from '../project-store';

/** One SDK tool as `createSdkMcpServer` accepts it. */
export type StudioTool = NonNullable<Parameters<typeof createSdkMcpServer>[0]['tools']>[number];

/**
 * Mutable per-turn state shared by every tool of one run. One proposal per
 * turn (cuts OR shots — kind-agnostic, matching the renderer's one-open-review
 * rule); one memory/promotion card per turn.
 */
export interface StudioTurnState {
  /** Id of the review-panel proposal created this turn, if any. */
  proposalId: string | null;
  /** Shots generated this pass, by id — overlays the request's pool snapshot. */
  generatedShots: Map<string, StudioShot>;
  memoryProposalCreated: boolean;
  stylePromotionCreated: boolean;
}

export function createTurnState(): StudioTurnState {
  return {
    proposalId: null,
    generatedShots: new Map(),
    memoryProposalCreated: false,
    stylePromotionCreated: false,
  };
}

export interface StudioToolContext {
  req: StudioAgentSendRequest;
  signal: AbortSignal;
  /** Resolved provider id (undefined = the app default). */
  providerId?: string;
  emit: (event: StudioAgentEvent) => void;
  state: StudioTurnState;
}

/** A tool result: plain text, optionally flagged as an error for the model. */
export function text(content: string, isError = false) {
  return { content: [{ type: 'text' as const, text: content }], ...(isError ? { isError: true } : {}) };
}

/** Emit a tool-activity chip for the chat panel. */
export function emitTool(ctx: StudioToolContext, tool: string, detail?: string): void {
  ctx.emit({
    projectId: ctx.req.projectId,
    kind: 'tool',
    tool,
    ...(detail ? { detail } : {}),
  });
}

/** True while a review-panel proposal is open (renderer's, or this turn's). */
export function reviewBlocked(ctx: StudioToolContext): boolean {
  return ctx.req.reviewOpen || ctx.state.proposalId !== null;
}

/** The project's active brand id, or undefined when it has none (or the
 *  project could not be loaded — a missing brand must never fail a tool). */
export async function readProjectBrandId(projectId: string): Promise<string | undefined> {
  try {
    return (await loadProject(projectId)).settings.brandId;
  } catch {
    return undefined;
  }
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
