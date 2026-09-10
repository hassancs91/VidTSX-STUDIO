// The agent tool registry (agents plan §1.3). One entry per capability; an
// installed agent's manifest names the subset it may call, and only those
// definitions are ever sent to the model, so token cost follows the manifest
// rather than the transport.
//
// TOOL IDS ARE APPEND-ONLY (plan §11). A renamed id silently breaks every
// installed agent that asked for it, so deprecate by keeping the id and
// returning a guidance error.

import type { NodeSpec } from '../../../../shared/types/flows';
import type { AgentToolDef, AgentToolNeed } from './types';
import { needMet } from './invoke-tool';
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

/** The registry stores definitions with their arg types erased; the zod schema
 *  validates before a handler ever sees the object. */
export type RegisteredTool = AgentToolDef<Record<string, unknown>>;

const registry = new Map<string, RegisteredTool>();

export function registerTool<TArgs>(def: AgentToolDef<TArgs>): void {
  if (registry.has(def.id)) {
    throw new Error(`Agent tool "${def.id}" is already registered`);
  }
  registry.set(def.id, def as unknown as RegisteredTool);
}

export function getTool(id: string): RegisteredTool | undefined {
  return registry.get(id);
}

export function listTools(): RegisteredTool[] {
  return [...registry.values()];
}

export function listToolIds(): string[] {
  return [...registry.keys()];
}

/** Test seam only — the built-ins re-register on the next import. */
export function clearRegistryForTests(): void {
  registry.clear();
}

export interface ToolSelection {
  /** Registered definitions the manifest asked for, in manifest order. */
  tools: RegisteredTool[];
  /** Ids the manifest asked for that no longer exist — install refuses these,
   *  so at runtime they mean the app was downgraded under an installed agent. */
  missing: string[];
  /** Selected tools whose capability is not configured. They stay in the
   *  server (§1.8) and the system prompt says they are unavailable. */
  unavailable: Array<{ id: string; needs: AgentToolNeed }>;
}

export interface ToolCapabilities {
  imageProvider: boolean;
  videoProvider: boolean;
  audioProvider: boolean;
}

/** Filter the registry by a manifest's allowlist. */
export function selectTools(toolIds: string[], capabilities: ToolCapabilities): ToolSelection {
  const tools: RegisteredTool[] = [];
  const missing: string[] = [];
  const unavailable: Array<{ id: string; needs: AgentToolNeed }> = [];
  const seen = new Set<string>();

  for (const id of toolIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const def = registry.get(id);
    if (!def) {
      missing.push(id);
      continue;
    }
    tools.push(def);
    const needs = def.needs;
    if (
      needs &&
      ((needs === 'image-provider' && !capabilities.imageProvider) ||
        (needs === 'video-provider' && !capabilities.videoProvider) ||
        (needs === 'audio-provider' && !capabilities.audioProvider))
    ) {
      unavailable.push({ id: def.id, needs });
    }
  }
  return { tools, missing, unavailable };
}

// ---------------------------------------------------------------------------
// Nodes (flows plan §1.2, decision 2): a tool with `ports` is also a node.
// ---------------------------------------------------------------------------

/** The tool behind a node id — only tools that carry `ports`. */
export function getNode(toolId: string): RegisteredTool | undefined {
  const def = registry.get(toolId);
  return def?.ports ? def : undefined;
}

/**
 * Serialisable node descriptions for the canvas (`FLOWS_NODES_LIST`). No
 * handler travels; `available` is false when the tool's gate is unmet right
 * now, and `priceHint` is read at list time so the catalog can change.
 */
export function listNodeSpecs(capabilities: ToolCapabilities): NodeSpec[] {
  const specs: NodeSpec[] = [];
  for (const def of registry.values()) {
    const ports = def.ports;
    if (!ports) continue;
    const priceHint = ports.priceHint?.();
    specs.push({
      id: def.id,
      label: ports.label,
      description: def.description,
      category: ports.category,
      inputs: ports.inputs,
      outputs: ports.outputs,
      configSchema: ports.configSchema,
      defaultConfig: ports.defaultConfig,
      ...(def.needs ? { needs: [def.needs], available: needMet(def.needs, capabilities) } : {}),
      ...(ports.priced ? { priced: true } : {}),
      ...(priceHint ? { priceHint } : {}),
      ...(ports.nondeterministic ? { nondeterministic: true } : {}),
    });
  }
  return specs;
}

// Wave 1 (plan §1.3). `run_flow` joins when Flows lands.
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
