// The stage action bar (agents plan §1.4): what an artifact can be handed to.
//
// Every action is main-side work plus a NAVIGATION hint. The renderer never
// decides where a file goes — it asks for an action by name and is told which
// screen to switch to, so a handoff is one round trip rather than a path the
// renderer has to know how to use.
//
// "Save to Library" only applies to work files (documents, compositions).
// Generated media is already born-managed library content (§1.11), so for a
// video or an image set the action reports the path it is already at rather
// than making a second copy of it.

import fs from 'fs/promises';
import path from 'path';
import { clipboard, shell } from 'electron';
import type {
  AgentArtifactActionKind,
  AgentArtifactActionResponse,
} from '../../../shared/ipc/types';
import type { AgentArtifact } from '../../../shared/types/agents';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { upsertEntry } from '../library/library-store';
import { sanitizeFolder, slugify, GENERATED_FOLDER } from '../library/library-filing';
import { importShot } from '../studio/shot-import';
import { getProjectsDir } from '../../utils/paths';
import { artifactFiles, artifactFilesIn, artifactRoot } from './artifact-paths';
import { runWebPageAction } from './web-page-actions';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentArtifactActions');

export interface ArtifactActionInput {
  agentId: string;
  sessionId: string;
  artifact: AgentArtifact;
  action: AgentArtifactActionKind;
  /** Library folder this session files into (§1.11). */
  libraryFolder?: string;
  brandId?: string;
  /** `open-in-studio`: the project the shot lands in. */
  projectId?: string;
  /** `export-site` / `open-in-browser`: the session's artifacts, for the
   *  page's media references. */
  artifacts?: AgentArtifact[];
  /** W8 Stage 2: a flow run's `files/` instead of the session workspace —
   *  the caller's `agentId` / `sessionId` are then labels only. */
  workspaceDir?: string;
}

function extensionFor(artifact: AgentArtifact): string {
  if (artifact.kind === 'composition') return '.tsx';
  if (artifact.kind === 'web-page') return '.html';
  return '.md';
}

/** Copy a work file into the library and register it as ordinary content. */
async function saveToLibrary(
  input: ArtifactActionInput,
  absPath: string,
): Promise<AgentArtifactActionResponse> {
  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(input.libraryFolder, GENERATED_FOLDER);
  const relPath = `${folder}/${slugify(input.artifact.title, input.artifact.kind)}${extensionFor(input.artifact)}`;
  const target = resolveLibraryPath(root, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(absPath, target);
  await upsertEntry(root, relPath, {
    origin: 'generated',
    description: input.artifact.title,
    ...(input.brandId ? { brandId: input.brandId } : {}),
  });
  return { success: true, relPath, navigateTo: 'assets' };
}

/**
 * A composition becomes a Creator project: `<projectsDir>/<name>/v1.tsx`, which
 * is exactly the folder-of-versions shape the Creator writes itself, so it
 * appears in the project list with no import step of its own.
 */
async function openInCreator(
  artifact: AgentArtifact,
  absPath: string,
): Promise<AgentArtifactActionResponse> {
  if (artifact.kind !== 'composition') {
    return { success: false, error: 'Only a composition can be opened in the TSX Creator.' };
  }
  const code = await fs.readFile(absPath, 'utf-8');
  const project = await writeCreatorProject(artifact, code);
  return { success: true, navigateTo: 'creator', open: project };
}

async function openInStudio(
  input: ArtifactActionInput,
  absPath: string,
): Promise<AgentArtifactActionResponse> {
  if (input.artifact.kind !== 'composition') {
    return { success: false, error: 'Only a composition can be imported into Studio as a shot.' };
  }
  if (!input.projectId) {
    return {
      success: false,
      error: 'Open a Studio project first — a shot has to be imported into one.',
    };
  }
  const outcome = await importShot({
    projectId: input.projectId,
    sourcePath: absPath,
    name: input.artifact.title,
  });
  if (outcome.error) {
    return {
      success: false,
      error: outcome.conformable
        ? `${outcome.error} Import it from Studio to convert it first.`
        : outcome.error,
    };
  }
  return { success: true, navigateTo: 'studio' };
}

export async function runArtifactAction(
  input: ArtifactActionInput,
): Promise<AgentArtifactActionResponse> {
  const files = input.workspaceDir
    ? await artifactFilesIn(input.workspaceDir, input.artifact)
    : await artifactFiles(input.agentId, input.sessionId, input.artifact);
  const primary = files[0];
  if (!primary) {
    return { success: false, error: 'This artifact has no file yet.' };
  }

  switch (input.action) {
    case 'save-to-library': {
      if (artifactRoot(input.artifact) === 'library') {
        // Already born-managed — report where it is rather than duplicating it.
        const relPath =
          input.artifact.kind === 'video' || input.artifact.kind === 'audio'
            ? input.artifact.payload.relPath
            : input.artifact.kind === 'image-set'
              ? input.artifact.payload.items[0]?.relPath
              : undefined;
        return {
          success: true,
          ...(relPath ? { relPath } : {}),
          navigateTo: 'assets',
        };
      }
      return saveToLibrary(input, primary);
    }
    case 'open-in-creator':
      return openInCreator(input.artifact, primary);
    case 'open-in-studio':
      return openInStudio(input, primary);
    case 'open-folder':
      shell.showItemInFolder(primary);
      return { success: true };
    case 'copy-path':
      clipboard.writeText(primary);
      return { success: true };
    case 'export-site':
    case 'open-in-browser':
      return runWebPageAction(input);
    case 'send-to-queue':
      // Enqueueing is the caller's job: it mints the `job` artifact and emits
      // the same `job-request` the render tool does, so both routes are one
      // flow. Reaching here means the caller did not intercept it.
      log.warn('send-to-queue reached the generic action path', { artifact: input.artifact.id });
      return { success: false, error: 'Only a composition can be sent to the render queue.' };
  }
}

/**
 * A fresh `<projectsDir>/<name>/` folder holding the composition as `v1.tsx`.
 * The name is claimed by `mkdir` failing rather than by a stat-then-create, so
 * two handoffs of the same title cannot both win the same folder.
 */
export async function writeCreatorProject(
  artifact: AgentArtifact,
  code: string,
): Promise<{ folderPath: string; versionPath: string }> {
  const base = slugify(artifact.title, 'agent-composition');
  const root = getProjectsDir();
  await fs.mkdir(root, { recursive: true });
  let name = base;
  for (let n = 2; n < 100; n += 1) {
    try {
      await fs.mkdir(path.join(root, name), { recursive: false });
      break;
    } catch {
      name = `${base}-${n}`;
    }
  }
  const folderPath = path.join(root, name);
  await fs.mkdir(folderPath, { recursive: true });
  const versionPath = path.join(folderPath, 'v1.tsx');
  await fs.writeFile(versionPath, code, 'utf-8');
  return { folderPath, versionPath };
}
