// Where a composition built by the TSX builder lives in a session workspace,
// and how a saved version becomes a `composition` artifact — shared by
// `generate_composition` and `edit_composition` (P3 part 4).
//
// A composition is a FOLDER of versions, the shape the builder saves and the
// Creator reads: `compositions/<slug>/vN.tsx` + `vN.src/` + `vN.assets/` +
// `vN.stills/` + `vN.debug.json` + `chat.json`. The artifact's relPath names
// one version. Older sessions hold flat `compositions/<slug>.tsx` files; every
// consumer reads relPath, so those keep working.
//
// The DURABLE half is the TSX file. `moduleUrl` points at the in-memory module
// store, which is gone after a restart (plan §1.5), so it rides along for this
// session's preview and the viewer re-serves on demand.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifactDraft } from '../../../../shared/types/agents';
import { ensureModuleServer, getModuleServerBaseUrl, storeTranspileResult } from '../../module-server';
import { transpileTsxSource } from '../../tsx-transpiler';
import { reserveFolder } from './workspace-files';

export const COMPOSITIONS_FOLDER = 'compositions';

export type CompositionDraft = Extract<AgentArtifactDraft, { kind: 'composition' }>;

/** A version's place in a composition folder, read from its relPath. */
export interface CompositionVersionPath {
  /** Workspace-relative folder, e.g. `compositions/promo`. */
  folderRel: string;
  version: number;
}

const VERSION_FILE = /^v(\d+)\.tsx$/i;

/**
 * `<parent>/<slug>/vN.tsx` → folder + N (`compositions/promo/v2.tsx`, or a copy
 * such as `context/promo/v2.tsx`); null for a flat legacy file. A version
 * folder sits at least two levels down, so a legacy `compositions/v1.tsx` (a
 * title that slugged to "v1") is still read as a flat file.
 */
export function compositionVersionOf(relPath: string): CompositionVersionPath | null {
  const posix = relPath.replace(/\\/g, '/');
  const match = VERSION_FILE.exec(path.posix.basename(posix));
  const folderRel = path.posix.dirname(posix);
  if (!match || folderRel.split('/').length < 2) return null;
  return { folderRel, version: Number(match[1]) };
}

/** A fresh empty `compositions/<slug>/` for a new build. */
export function reserveCompositionFolder(
  workspaceDir: string,
  title: string,
): Promise<{ relDir: string; absDir: string }> {
  return reserveFolder(workspaceDir, COMPOSITIONS_FOLDER, title, 'composition');
}

/** Remove a reserved folder the build never wrote into (a failed or cancelled build), so the title is free again. */
export async function releaseEmptyFolder(absDir: string): Promise<void> {
  await fs.rmdir(absDir).catch(() => {});
}

/** The workspace-relative POSIX path of a file inside the workspace. */
export function workspaceRel(workspaceDir: string, absPath: string): string {
  const rel = path.relative(workspaceDir, absPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`The build saved outside the session workspace: ${absPath}`);
  }
  return rel.split(path.sep).join('/');
}

/**
 * Serve a saved version and describe it as an artifact draft. The builder's
 * `check` already passed on this code, so a transpile failure here is a bug
 * rather than a model mistake: it throws.
 */
export async function compositionDraft(
  workspaceDir: string,
  versionPath: string,
  title: string,
): Promise<CompositionDraft> {
  const relPath = workspaceRel(workspaceDir, versionPath);
  const code = await fs.readFile(versionPath, 'utf-8');
  await ensureModuleServer();
  const baseUrl = getModuleServerBaseUrl();
  if (!baseUrl) throw new Error('The module server is not running, so the composition cannot be previewed.');
  const result = await transpileTsxSource(code, path.basename(versionPath), baseUrl);
  if (!result.success) {
    throw new Error(`The composition passed the builder's check but would not transpile: ${result.error}`);
  }
  const moduleUrl = storeTranspileResult(result);
  return {
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
  };
}
