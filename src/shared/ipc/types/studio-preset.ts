// Preset-update card IPC (V1 completion plan §2.5 "learn from this video").
// The library CRUD for presets lives in library.ts beside the brands.

import type { StudioProject } from '../../types/studio';
import type { StudioPresetUpdateProposal } from '../../types/studio-preset';

/** studio:preset:learn — the Inspector button. The renderer hands in the
 *  LIVE document (it owns it; the save debounce may lag). Main measures it,
 *  writes ONE LLM summary, queues the card and pushes it on the agent event
 *  stream so the Assistant tab shows it. */
export interface StudioPresetLearnRequest {
  projectId: string;
  project: StudioProject;
}

export interface StudioPresetLearnResponse {
  success: boolean;
  proposal?: StudioPresetUpdateProposal;
  error?: string;
}

/** studio:preset:proposals:get — pending cards for one project (0 or 1). */
export interface StudioPresetProposalsGetRequest {
  projectId: string;
}

export interface StudioPresetProposalsGetResponse {
  success: boolean;
  proposals?: StudioPresetUpdateProposal[];
  error?: string;
}

/** studio:preset:proposal:resolve — accept writes the preset (knobs, the
 *  learned section, the learned log); reject discards the card. */
export interface StudioPresetProposalResolveRequest {
  projectId: string;
  proposalId: string;
  action: 'accept' | 'reject';
}

export interface StudioPresetProposalResolveResponse {
  success: boolean;
  /** On accept: the preset name and how many knobs changed. */
  presetName?: string;
  knobsChanged?: number;
  error?: string;
}
