// The ONE adapter between an agent session and a Motion (TSX Creator)
// project (V1 completion plan §2.7, W7).
//
// A session opened from the Creator's Agent mode carries `motionSink: true`.
// Every `composition` draft such a session files is ALSO written as the next
// `vN.tsx` of a Motion project — the folder-of-versions the Creator reads, so
// the preview loads it and the Render button renders it exactly as in prompt
// mode. The project is CREATED by the first composition and named after it
// (`reserveProjectFolder`, the prompt mode's own naming path), and its id —
// the folder name, relative to the projects dir — is remembered on the
// session so the second composition lands beside the first.
//
// The draft comes back with `payload.motion` set, so the renderer learns the
// version path off the same `artifact` event it already receives. Nothing
// here touches the artifact store: the runner files what this returns.

import fs from 'fs/promises';
import path from 'path';
import type { AgentArtifactDraft, AgentSession } from '../../../shared/types/agents';
import { getProjectsDir } from '../../utils/paths';
import { reserveProjectFolder, writeNextVersion } from '../tsx-jobs/project-store';

export interface MotionSinkResult {
  draft: AgentArtifactDraft;
  /** Set when the sink just created the project — patch it onto the session. */
  motionProjectId?: string;
}

/**
 * `<projectsDir>/<id>` for an id that is a plain relative folder path. An id
 * is written by this file from `reserveProjectFolder`, so anything else is a
 * hand-edited session record — refused rather than resolved.
 */
export function resolveMotionProjectFolder(projectsDir: string, projectId: string): string {
  const trimmed = projectId.trim();
  if (!trimmed || trimmed !== projectId) {
    throw new Error('motionProjectId must be a non-empty relative folder');
  }
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed) || trimmed.startsWith('\\\\')) {
    throw new Error(`motionProjectId must be relative, got "${projectId}"`);
  }
  const segments = trimmed.replace(/\\/g, '/').split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error(`motionProjectId must not contain empty, "." or ".." segments, got "${projectId}"`);
  }
  return path.join(projectsDir, ...segments);
}

/**
 * Mirror a composition draft into the session's Motion project. Drafts of
 * other kinds, and sessions without the sink, pass through untouched.
 */
export async function sinkCompositionIntoMotionProject(
  session: AgentSession,
  draft: AgentArtifactDraft,
  workspaceDir: string,
  projectsDir: string = getProjectsDir(),
): Promise<MotionSinkResult> {
  if (!session.motionSink || draft.kind !== 'composition') return { draft };

  const code = await fs.readFile(path.join(workspaceDir, draft.payload.relPath), 'utf-8');

  let projectId = session.motionProjectId;
  let folderPath: string;
  if (projectId) {
    folderPath = resolveMotionProjectFolder(projectsDir, projectId);
    // The user may have deleted the project from the library mid-session;
    // the next version recreates it rather than failing the tool call.
    await fs.mkdir(folderPath, { recursive: true });
  } else {
    const reserved = await reserveProjectFolder(draft.title, projectsDir);
    folderPath = reserved.folderPath;
    projectId = reserved.name;
  }

  const versionPath = await writeNextVersion(folderPath, code);
  return {
    draft: {
      ...draft,
      payload: { ...draft.payload, motion: { folderPath, versionPath } },
    },
    ...(projectId !== session.motionProjectId ? { motionProjectId: projectId } : {}),
  };
}
