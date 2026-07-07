import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import type {
  TranscriptionProjectData,
  TranscriptResult,
  TranscriptSegment,
} from '../../shared/ipc/types';
import { getDb, getProjectsDir } from './transcription-projects-db';

const log = logEngine.createLogger('transcription-projects-migrate');

function isSegment(s: unknown): s is TranscriptSegment {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === 'number' &&
    typeof o.start === 'number' &&
    typeof o.end === 'number' &&
    typeof o.text === 'string'
  );
}

function isResult(r: unknown): r is TranscriptResult {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.language === 'string' &&
    typeof o.duration === 'number' &&
    typeof o.text === 'string' &&
    Array.isArray(o.segments) &&
    o.segments.every(isSegment)
  );
}

function isLegacyProject(p: unknown): p is TranscriptionProjectData {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.sourceFilePath === 'string' &&
    typeof o.sourceFileName === 'string' &&
    (o.sourceFileType === 'video' || o.sourceFileType === 'audio') &&
    typeof o.modelId === 'string' &&
    typeof o.language === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number' &&
    isResult(o.result)
  );
}

/**
 * One-shot migration. Safe to call on every launch.
 *
 *  1. Read every `{id}.json` in the transcription-projects directory.
 *  2. If the DB is empty, import them; otherwise skip (a prior run already migrated).
 *  3. Rename every successfully imported file to `.json.backup-{timestamp}` so the
 *     next launch skips it — we keep the file rather than deleting it, as a safety net.
 */
export async function migrateTranscriptionProjects(): Promise<void> {
  const dir = getProjectsDir();

  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    log.error('Failed to ensure transcription-projects directory', err);
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
    db.prepare('SELECT COUNT(*) AS n FROM transcription_projects').get() as { n: number }
  ).n;

  if (existingCount > 0) {
    // DB already has data but legacy files remain. Back them up so we don't re-import.
    for (const file of jsonFiles) {
      await backupLegacyFile(path.join(dir, file));
    }
    return;
  }

  const insertProject = db.prepare(
    `INSERT OR IGNORE INTO transcription_projects
       (id, name, source_file_path, source_file_name, source_file_type,
        model_id, language, result_language, result_duration, result_text,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSegment = db.prepare(
    `INSERT OR IGNORE INTO transcription_segments
       (project_id, segment_id, start_time, end_time, text)
     VALUES (?, ?, ?, ?, ?)`
  );

  const imported: string[] = [];
  const projects: TranscriptionProjectData[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(dir, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!isLegacyProject(parsed)) {
        log.warn('Skipping malformed transcription project', { file });
        continue;
      }
      projects.push(parsed);
      imported.push(filePath);
    } catch (err) {
      log.warn('Failed to read legacy transcription project', {
        file,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (projects.length === 0) return;

  const txn = db.transaction(() => {
    for (const p of projects) {
      insertProject.run(
        p.id,
        p.name,
        p.sourceFilePath,
        p.sourceFileName,
        p.sourceFileType,
        p.modelId,
        p.language,
        p.result.language,
        p.result.duration,
        p.result.text,
        p.createdAt,
        p.updatedAt
      );
      for (const seg of p.result.segments) {
        insertSegment.run(p.id, seg.id, seg.start, seg.end, seg.text);
      }
    }
  });
  txn();

  log.info('Imported legacy transcription projects into SQLite', {
    count: projects.length,
  });

  for (const filePath of imported) {
    await backupLegacyFile(filePath);
  }
}

async function backupLegacyFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy transcription project to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
