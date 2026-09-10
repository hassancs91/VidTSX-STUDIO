// Where an artifact's files actually live, and what a viewer is given instead
// of a path (agents plan §1.4, §1.5, §1.11).
//
// Artifact `relPath`s are relative to one of TWO roots, decided by kind:
//
//   document, composition, web-page → the session workspace (work files, never media)
//   video, image-set, audio         → the ASSET LIBRARY (born-managed, §1.11)
//
// That split is not stated in one place in the plan — it falls out of §1.4
// ("relative to the session workspace") and §1.11 ("generated media never lands
// in a shared pile"), and getting it wrong resolves a video against a folder it
// was never in. So it is written down once, here, and every caller asks.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifact } from '../../../shared/types/agents';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { ensureModuleServer, getModuleServerBaseUrl, storeTranspileResult } from '../module-server';
import { transpileTsxSource } from '../tsx-transpiler';
import { agentWorkspaceDir } from './agent-sessions';

export type ArtifactRoot = 'workspace' | 'library';

export function artifactRoot(artifact: AgentArtifact): ArtifactRoot {
  return artifact.kind === 'video' || artifact.kind === 'image-set' || artifact.kind === 'audio'
    ? 'library'
    : 'workspace';
}

/** Every file an artifact owns, as absolute paths. Empty for `job`. */
export async function artifactFiles(
  agentId: string,
  sessionId: string,
  artifact: AgentArtifact,
): Promise<string[]> {
  const root =
    artifactRoot(artifact) === 'library'
      ? await ensureLibraryRoot()
      : agentWorkspaceDir(agentId, sessionId);
  const resolve = (relPath: string): string =>
    artifactRoot(artifact) === 'library'
      ? resolveLibraryPath(root, relPath)
      : path.join(root, relPath);

  switch (artifact.kind) {
    case 'document':
    case 'composition':
    case 'video':
    case 'audio':
    case 'web-page':
      return [resolve(artifact.payload.relPath)];
    case 'image-set':
      return artifact.payload.items.map((item) => resolve(item.relPath));
    case 'job':
      return [];
  }
}

/**
 * A url the module server will serve for a media file. The `/asset` route only
 * serves a media allowlist, which is exactly what `video` and `image-set` hold.
 */
export async function assetUrlFor(absPath: string): Promise<string> {
  await ensureModuleServer();
  const base = getModuleServerBaseUrl();
  if (!base) throw new Error('The preview server is not running.');
  return `${base}/asset?path=${encodeURIComponent(absPath)}`;
}

/**
 * A live module url for a composition (§1.5): the module store is in-memory, so
 * a session reopened after a restart has a `moduleUrl` pointing at nothing. The
 * durable half is the TSX, and re-transpiling it is fast — so the viewer asks
 * for a url rather than trusting the one on the artifact.
 */
export async function ensureCompositionModule(
  agentId: string,
  sessionId: string,
  artifact: Extract<AgentArtifact, { kind: 'composition' }>,
): Promise<string> {
  const absPath = path.join(agentWorkspaceDir(agentId, sessionId), artifact.payload.relPath);
  const code = await fs.readFile(absPath, 'utf-8');
  await ensureModuleServer();
  const base = getModuleServerBaseUrl();
  if (!base) throw new Error('The preview server is not running.');
  const result = await transpileTsxSource(code, path.basename(absPath), base);
  if (!result.success) {
    throw new Error(`This composition no longer transpiles: ${result.error}`);
  }
  return storeTranspileResult(result);
}
