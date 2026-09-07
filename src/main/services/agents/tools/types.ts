// PROVISIONAL — the agents feature has not been built yet.
//
// `docs/agents-plan.md` §1.3 owns the real tool registry (`registry.ts`, the
// full `AgentToolContext` with the artifact store, the interaction `ask`, the
// run-event `emit`). Stage 1 of that plan replaces this file. It exists now
// only so the `generate_video` definition the video-providers plan asks for in
// its Stage 5 can be written, typed and reviewed against the shipped engine
// rather than against a plan — see `generate-video.ts` next to it.
//
// Deliberately the smallest surface a tool needs: anything richer would be
// this plan guessing at the agents plan's design.

import type { ZodRawShape } from 'zod';

/** Capability gate, surfaced in the agent UI and checked before a run. */
export type AgentToolNeed = 'image-provider' | 'video-provider';

/** What a tool hands back to the model, in the Agent SDK's content shape. */
export interface AgentToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  /** Filed by the runner into the session's artifact store, when a tool made
   *  something the user should be able to open. */
  artifact?: AgentArtifactDraft;
}

/** A produced artifact, before the store gives it an id and a version. */
export interface AgentArtifactDraft {
  kind: 'video';
  title: string;
  payload: {
    /** Video Studio entry id — the clip's gated, local home. */
    entryId: string;
    /** Path inside the asset library, relative to its root. */
    relPath: string;
    durationSeconds: number;
    aspectRatio: string;
    hasAudio: boolean;
  };
}

export interface AgentToolContext {
  /** Cancels with the run. */
  signal: AbortSignal;
  /** Library folder this session files into; `generated/` when absent. */
  libraryFolder?: string;
  /** Brand to auto-tag output with, when the session has one. */
  brandId?: string;
  /** Progress line for the run transcript. */
  emit?: (detail: string) => void;
}

export interface AgentToolDef<TArgs = Record<string, unknown>> {
  id: string;
  /** Sent to the model. */
  description: string;
  schema: ZodRawShape;
  needs?: AgentToolNeed;
  handler: (args: TArgs, ctx: AgentToolContext) => Promise<AgentToolResult>;
}
