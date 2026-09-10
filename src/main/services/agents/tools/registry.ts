// The agent tool registry (agents plan §1.3). One entry per capability; an
// installed agent's manifest names the subset it may call, and only those
// definitions are ever sent to the model, so token cost follows the manifest
// rather than the transport.
//
// TOOL IDS ARE APPEND-ONLY (plan §11). A renamed id silently breaks every
// installed agent that asked for it, so deprecate by keeping the id and
// returning a guidance error.
//
// W8 Stage 4: the map and its readers moved to `registry-core.ts` so a tool
// that needs the registry at load (`run_flow`, `run_agent`) does not form an
// import cycle with this file; this file registers and re-exports.

export * from './registry-core';
import { registerTool } from './registry-core';
import { writeDocumentTool } from './write-document';
import { listArtifactsTool } from './list-artifacts';
import { askUserTool } from './ask-user';
import { generateCompositionTool } from './generate-composition';
import { editCompositionTool } from './edit-composition';
import { renderCompositionTool } from './render-composition';
import { generateImageTool } from './generate-image';
import { generateVideoTool } from './generate-video';
import { proposeMemoryTool } from './propose-memory';
import { getBrandTool } from './get-brand';
import { generateAudioTool } from './generate-audio';
import { writePageTool } from './write-page';
import { editPageTool } from './edit-page';
import { capturePageTool } from './capture-page';
import { exportSiteTool } from './export-site';
import { inputTextTool } from './input-text';
import { inputImageLibraryTool } from './input-image-library';
import { inputImageFileTool } from './input-image-file';
import { inputVideoFileTool } from './input-video-file';
import { generateTextTool } from './generate-text';
import { transcribeTool } from './transcribe';
import { captionVideoTool } from './caption-video';
import { textToSpeechTool } from './text-to-speech';
import { extractFrameTool } from './extract-frame';
import { trimVideoTool } from './trim-video';
import { concatVideosTool } from './concat-videos';
import { saveToLibraryTool } from './save-to-library';
import { runFlowTool } from './run-flow';
import { runAgentTool } from './run-agent';
import { listNodesTool } from './list-nodes';
import { readFlowTool } from './read-flow';
import { proposeFlowTool } from './propose-flow';
import { readRunTool } from './read-run';
import { freezeSessionToFlowTool } from './freeze-session-to-flow';
import { saveFlowTool } from './save-flow';

// Wave 1 (plan §1.3).
registerTool(writeDocumentTool);
registerTool(generateCompositionTool);
registerTool(editCompositionTool);
registerTool(renderCompositionTool);
registerTool(generateImageTool);
registerTool(generateVideoTool);
registerTool(askUserTool);
registerTool(listArtifactsTool);
registerTool(proposeMemoryTool);
// W4: the session's brand on demand.
registerTool(getBrandTool);
// W2b: sound effects + music.
registerTool(generateAudioTool);
// W9: the web designer's pages.
registerTool(writePageTool);
registerTool(editPageTool);
registerTool(capturePageTool);
registerTool(exportSiteTool);
// W8 Stage 1: the flow input resolvers and the LLM text node (flows plan §1.2).
registerTool(inputTextTool);
registerTool(inputImageLibraryTool);
registerTool(inputImageFileTool);
registerTool(inputVideoFileTool);
registerTool(generateTextTool);
// W8 Stage 3: the product nodes (flows plan §6) — STT, captions, TTS, frames,
// the two ffmpeg edits and the library import, each a thin wrapper.
registerTool(transcribeTool);
registerTool(captionVideoTool);
registerTool(textToSpeechTool);
registerTool(extractFrameTool);
registerTool(trimVideoTool);
registerTool(concatVideosTool);
registerTool(saveToLibraryTool);
// W8 Stage 4: flows from agents (`run_flow`, agent-only), agents inside
// flows (`run_agent`, the one non-deterministic node) and the Flow Builder's
// tools (flows plan §7).
registerTool(runFlowTool);
registerTool(runAgentTool);
registerTool(listNodesTool);
registerTool(readFlowTool);
registerTool(proposeFlowTool);
registerTool(readRunTool);
// W8 Stage 5: freeze a session into a flow (flows plan §1.5) — the draft
// from the lineage walk, and the one tool that names it.
registerTool(freezeSessionToFlowTool);
registerTool(saveFlowTool);
