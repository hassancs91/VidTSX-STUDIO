// Turning generated TSX into a `composition` artifact — shared by
// `generate_composition` and `edit_composition`.
//
// The DURABLE half is the TSX file in the session workspace. `moduleUrl` points
// at the in-memory module store, which is gone after a restart (plan §1.5), so
// it rides along for this session's preview and the viewer re-serves on demand.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifactDraft } from '../../../../shared/types/agents';
import { ensureModuleServer, getModuleServerBaseUrl, storeTranspileResult } from '../../module-server';
import { transpileTsxSource } from '../../tsx-transpiler';
import { reserveWorkspaceFile } from './workspace-files';

export interface StoredComposition {
  draft: Extract<AgentArtifactDraft, { kind: 'composition' }>;
  relPath: string;
}

/**
 * Write the code, serve it, and describe it as an artifact draft. The code has
 * already passed the acceptance gate (`buildAgentTsxDeps`), so a transpile
 * failure here is a bug rather than a model mistake — it throws.
 */
export async function storeComposition(
  workspaceDir: string,
  title: string,
  code: string,
): Promise<StoredComposition> {
  const { relPath, absPath } = await reserveWorkspaceFile(
    workspaceDir,
    'compositions',
    title,
    '.tsx',
    'composition',
  );
  await fs.writeFile(absPath, code, 'utf-8');

  await ensureModuleServer();
  const baseUrl = getModuleServerBaseUrl();
  if (!baseUrl) throw new Error('The module server is not running, so the composition cannot be previewed.');
  const result = await transpileTsxSource(code, path.basename(absPath), baseUrl);
  if (!result.success) {
    throw new Error(`The composition passed the gate but would not transpile: ${result.error}`);
  }
  const moduleUrl = storeTranspileResult(result);

  return {
    relPath,
    draft: {
      kind: 'composition',
      title,
      payload: {
        relPath,
        moduleUrl,
        config: {
          id: result.config.id,
          durationInFrames: result.config.durationInFrames,
          fps: result.config.fps,
          width: result.config.width,
          height: result.config.height,
        },
      },
    },
  };
}
