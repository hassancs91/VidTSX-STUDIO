import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import type { StudioProjectData, VideoMetadata } from '../../shared/ipc/types';
import { getDb, getStudioProjectsDir, saveProject } from './studio-projects-db';

const log = logEngine.createLogger('studio-projects-migrate');

function isVideoMetadata(v: unknown): v is VideoMetadata {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.durationInSeconds === 'number' &&
    typeof o.durationInFrames === 'number' &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    typeof o.fps === 'number' &&
    typeof o.codec === 'string' &&
    typeof o.fileSize === 'number' &&
    typeof o.fileName === 'string' &&
    typeof o.filePath === 'string'
  );
}

function isProject(p: unknown): p is StudioProjectData {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.videoPath === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number' &&
    isVideoMetadata(o.metadata)
  );
}

/**
 * One-shot migration. Safe to call on every launch.
 * Reads every `{id}.json` in the studio-projects dir, imports into SQLite
 * (when DB is empty), then renames each imported file to `.json.backup-{ts}`.
 */
export async function migrateStudioProjects(): Promise<void> {
  const dir = getStudioProjectsDir();

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    log.error('Failed to ensure studio-projects directory', err);
    return;
  }

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return;
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  if (jsonFiles.length === 0) return;

  const db = getDb();
  const existingCount = (
    db.prepare('SELECT COUNT(*) AS n FROM studio_projects').get() as { n: number }
  ).n;

  if (existingCount > 0) {
    // DB already has data — retire leftover JSON files so we don't reimport next run.
    for (const file of jsonFiles) {
      await backupFile(path.join(dir, file));
    }
    return;
  }

  const imported: string[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(dir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!isProject(parsed)) {
        log.warn('Skipping malformed studio project', { file });
        continue;
      }
      const meta = parsed.metadata as VideoMetadata;
      const project: StudioProjectData = {
        ...parsed,
        composition: {
          width: meta.width,
          height: meta.height,
          fps: meta.fps,
          durationInFrames: meta.durationInFrames,
          durationInSeconds: meta.durationInSeconds,
        },
      };
      await saveProject(project);
      imported.push(filePath);
    } catch (err) {
      log.warn('Failed to read legacy studio project', {
        file,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (imported.length > 0) {
    log.info('Imported legacy studio projects into SQLite', { count: imported.length });
  }

  for (const filePath of imported) {
    await backupFile(filePath);
  }
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy studio project to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
