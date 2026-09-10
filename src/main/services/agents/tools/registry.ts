// The agent tool registry (agents plan §1.3). One entry per capability; an
// installed agent's manifest names the subset it may call, and only those
// definitions are ever sent to the model, so token cost follows the manifest
// rather than the transport.
//
// TOOL IDS ARE APPEND-ONLY (plan §11). A renamed id silently breaks every
// installed agent that asked for it, so deprecate by keeping the id and
// returning a guidance error.

import type { AgentToolDef, AgentToolNeed } from './types';
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
