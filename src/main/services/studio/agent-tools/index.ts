// The Studio agent's tool server, assembled from the group files. Tool ids
// are APPEND-ONLY (V1 completion plan §4): a new tool is a new entry at the
// end of STUDIO_TOOL_IDS plus a group file — never a change to an existing
// id, and never a tool back in studio-agent.ts.

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { buildTranscriptTools } from './transcript-tools';
import { buildCutTools } from './cut-tools';
import { buildShotTools } from './shot-tools';
import { buildImageTools } from './image-tools';
import { buildCaptureTools } from './capture-tools';
import { buildMemoryTools } from './memory-tools';
import { buildWorkflowTools } from './workflow-tools';
import { buildVideoTools } from './video-tools';
import { buildInsertTools } from './insert-tools';
import { buildProjectTools } from './project-tools';
import { buildDeliveryTools } from './delivery-tools';
import { buildScriptTools } from './script-tools';
import { buildVocabularyTools } from './vocabulary-tools';
import type { StudioToolContext } from './types';

export { createTurnState } from './types';
export type { StudioToolContext, StudioTurnState } from './types';

/** Every tool the server registers, in registration order. Append-only. */
export const STUDIO_TOOL_IDS = [
  'get_transcript',
  'propose_cuts',
  'list_shots',
  'generate_tsx_shot',
  'propose_shots',
  'generate_image',
  'remove_background',
  'capture_webpage',
  'capture_scripted',
  'propose_memory',
  'propose_style_promotion',
  // W3 (2026-09-09): the end-to-end steps.
  'transcribe_asset',
  'run_auto_cut',
  'generate_video',
  'insert_asset',
  'list_assets',
  'get_brand',
  'set_captions',
  'accept_proposal',
  'export_project',
  // W4 (2026-09-09): script and vocabulary.
  'get_script',
  'propose_vocabulary',
] as const;

export type StudioToolId = (typeof STUDIO_TOOL_IDS)[number];

/** The SDK allowlist form (`mcp__<server>__<tool>`). */
export const STUDIO_ALLOWED_TOOLS: readonly string[] = STUDIO_TOOL_IDS.map(
  (id) => `mcp__studio__${id}`,
);

export function buildStudioToolServer(ctx: StudioToolContext) {
  return createSdkMcpServer({
    name: 'studio',
    version: '1.0.0',
    tools: [
      ...buildTranscriptTools(ctx),
      ...buildCutTools(ctx),
      ...buildShotTools(ctx),
      ...buildImageTools(ctx),
      ...buildCaptureTools(ctx),
      ...buildMemoryTools(ctx),
      ...buildWorkflowTools(ctx),
      ...buildVideoTools(ctx),
      ...buildInsertTools(ctx),
      ...buildProjectTools(ctx),
      ...buildDeliveryTools(ctx),
      ...buildScriptTools(ctx),
      ...buildVocabularyTools(ctx),
    ],
  });
}
