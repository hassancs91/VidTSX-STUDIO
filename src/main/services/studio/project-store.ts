import fs from 'fs/promises';
import path from 'path';
import { shell } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import {
  STUDIO_SCHEMA_VERSION,
  STUDIO_SCRIPT_MAX_CHARS,
  type StudioProject,
} from '../../../shared/types/studio';
import type { StudioProjectSummary } from '../../../shared/ipc/types/studio';
import { normalizeShots } from '../../../shared/studio/shots';
import { normalizeCaptionLayer } from '../../../shared/studio/caption-layer';
import { reserveProjectFolder } from '../tsx-jobs/project-store';
import {
  ensureProjectScaffold,
  getProjectDir,
  getProjectFilePath,
  getStudioProjectsDir,
} from './studio-paths';

const log = logEngine.createLogger('StudioProjectStore');

/** Validate + normalize a parsed project.json. Throws on unusable documents.
 *  `id` always comes from the folder name — the folder is the truth. */
export function migrateProject(raw: unknown, folderId: string): StudioProject {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('project.json is not an object');
  }
  const doc = raw as Partial<StudioProject>;
  if (doc.schemaVersion !== STUDIO_SCHEMA_VERSION) {
    throw new Error(`Unsupported project schema version: ${String(doc.schemaVersion)}`);
  }
  const settings = doc.settings;
  if (
    !settings ||
    typeof settings.width !== 'number' ||
    typeof settings.height !== 'number' ||
    typeof settings.fps !== 'number'
  ) {
    throw new Error('project.json is missing width/height/fps settings');
  }
  // Caption layer (D13): clamped into range, dropped whole when unusable. An
  // uninstalled templateId survives on purpose — reinstalling the pack must
  // bring the captions back (PACKS_DESIGN.md graceful degrade).
  const captions = normalizeCaptionLayer(doc.captions);
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: folderId,
    name: typeof doc.name === 'string' && doc.name ? doc.name : folderId,
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : new Date().toISOString(),
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date().toISOString(),
    settings: { ...settings, agent: settings.agent ?? {} },
    assets: Array.isArray(doc.assets) ? doc.assets : [],
    timeline: doc.timeline && Array.isArray(doc.timeline.tracks) ? doc.timeline : { tracks: [] },
    proposals: Array.isArray(doc.proposals) ? doc.proposals : [],
    // Validates entries and flips crash-stuck 'generating' shots to 'error'
    // (reconcile-on-open, TSX_SHOTS_DESIGN.md D9).
    shots: normalizeShots(doc.shots),
    ...(captions ? { captions } : {}),
    // Script (W4): a string or nothing; an empty/whitespace script is absent.
    ...(typeof doc.script === 'string' && doc.script.trim() !== ''
      ? { script: doc.script.slice(0, STUDIO_SCRIPT_MAX_CHARS) }
      : {}),
  };
}

/** Atomic write: temp file in the same folder, then rename over project.json. */
async function writeProjectFile(projectDir: string, project: StudioProject): Promise<void> {
  const finalPath = getProjectFilePath(projectDir);
  const tmpPath = `${finalPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(project, null, 2), 'utf-8');
  await fs.rename(tmpPath, finalPath);
}

function toSummary(project: StudioProject, folderPath: string): StudioProjectSummary {
  return {
    id: project.id,
    name: project.name,
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    assetCount: project.assets.length,
    folderPath,
  };
}

export async function createProject(
  name: string,
  width: number,
  height: number,
  fps: number,
  /** Brand snapshot copied from the Studio default at creation (D11) —
   *  resolved and validated by the caller; never re-read after this. */
  brandId?: string,
): Promise<StudioProject> {
  const projectsDir = await getStudioProjectsDir();
  const { folderPath, name: folderId } = await reserveProjectFolder(name, projectsDir);
  await ensureProjectScaffold(folderPath);

  const now = new Date().toISOString();
  const project: StudioProject = {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: folderId,
    name: name.trim() || folderId,
    createdAt: now,
    updatedAt: now,
    settings: { width, height, fps, agent: {}, ...(brandId ? { brandId } : {}) },
    assets: [],
    timeline: {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: [] },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    },
    proposals: [],
    shots: [],
  };
  await writeProjectFile(folderPath, project);
  return project;
}

/** Folder-as-truth listing: scan each projects/<id>/project.json, skip corrupt ones. */
export async function listProjects(): Promise<StudioProjectSummary[]> {
  const projectsDir = await getStudioProjectsDir();
  let entries;
  try {
    entries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return []; // Root not created yet — no projects.
  }

  const summaries: StudioProjectSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const folderPath = path.join(projectsDir, entry.name);
    try {
      const raw = await fs.readFile(getProjectFilePath(folderPath), 'utf-8');
      const project = migrateProject(JSON.parse(raw), entry.name);
      summaries.push(toSummary(project, folderPath));
    } catch (err) {
      log.warn('Skipping unreadable project folder', {
        folder: entry.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

export async function loadProject(id: string): Promise<StudioProject> {
  const projectDir = await getProjectDir(id);
  const raw = await fs.readFile(getProjectFilePath(projectDir), 'utf-8');
  return migrateProject(JSON.parse(raw), id);
}

export async function saveProject(project: StudioProject): Promise<string> {
  const projectDir = await getProjectDir(project.id);
  await fs.access(projectDir); // Must already exist — save never creates projects.
  const updatedAt = new Date().toISOString();
  await writeProjectFile(projectDir, { ...project, updatedAt });
  return updatedAt;
}

/** Move to the OS trash when possible; fall back to permanent removal. */
export async function deleteProject(id: string): Promise<void> {
  const projectDir = await getProjectDir(id);
  try {
    await shell.trashItem(projectDir);
  } catch {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
}
