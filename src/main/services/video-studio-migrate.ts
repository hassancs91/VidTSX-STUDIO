import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logEngine } from '../../logging/log-engine';
import { getStudioDir, getVideosDir, getThumbnailsDir } from './video-studio-files';
import { getDb } from './video-studio-db';

const log = logEngine.createLogger('video-studio-migrate');

function contentTypeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.webm') return 'video/webm';
  if (e === '.mov') return 'video/quicktime';
  return 'video/mp4';
}

/** Parse `vid-{timestamp}-{shortId}.ext` → timestamp, else falls back to the file mtime. */
function parseTimestampFromFileName(fileName: string, fallback: number): number {
  const match = fileName.match(/^vid-(\d+)-/);
  if (match) {
    const ts = Number(match[1]);
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  return fallback;
}

/**
 * One-shot reconciliation. Safe to call on every launch.
 *
 * Any file on disk under videos/ that isn't in the DB gets re-added with
 * placeholder metadata inside an auto-created "Recovered" folder.
 */
export async function migrateVideoStudio(): Promise<void> {
  try {
    await fs.mkdir(getStudioDir(), { recursive: true });
    await fs.mkdir(getVideosDir(), { recursive: true });
    await fs.mkdir(getThumbnailsDir(), { recursive: true });
  } catch (err) {
    log.error('Failed to ensure video-studio directories', err);
    return;
  }

  const db = getDb();
  await reconcileOrphans(db);
}

async function reconcileOrphans(db: import('better-sqlite3').Database): Promise<void> {
  let files: string[];
  try {
    files = await fs.readdir(getVideosDir());
  } catch {
    return;
  }

  const validExt = (f: string) => /\.(mp4|webm|mov)$/i.test(f);
  const onDisk = files.filter(validExt);
  if (onDisk.length === 0) return;

  const knownRows = db.prepare('SELECT file_name FROM videos').all() as { file_name: string }[];
  const known = new Set(knownRows.map((r) => r.file_name));

  const orphans = onDisk.filter((f) => !known.has(f));
  if (orphans.length === 0) return;

  const existingRecovered = db
    .prepare("SELECT id FROM folders WHERE name = 'Recovered' LIMIT 1")
    .get() as { id: string } | undefined;
  const recoveredFolderId = existingRecovered?.id ?? crypto.randomUUID();

  const insertFolder = db.prepare(
    'INSERT OR IGNORE INTO folders (id, name, created_at) VALUES (?, ?, ?)'
  );
  const insertVideo = db.prepare(
    `INSERT INTO videos
       (id, file_name, thumbnail_file_name, prompt, model, aspect_ratio,
        duration_seconds, has_audio, size_bytes, content_type,
        credits_consumed, source_url, created_at, folder_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const statsByName = new Map<string, { mtimeMs: number; size: number }>();
  for (const f of orphans) {
    try {
      const s = await fs.stat(path.join(getVideosDir(), f));
      statsByName.set(f, { mtimeMs: s.mtimeMs, size: s.size });
    } catch {
      statsByName.set(f, { mtimeMs: Date.now(), size: 0 });
    }
  }

  const txn = db.transaction(() => {
    if (!existingRecovered) {
      insertFolder.run(recoveredFolderId, 'Recovered', Date.now());
    }

    for (const fileName of orphans) {
      const id = crypto.randomUUID();
      const ext = path.extname(fileName);
      const stat = statsByName.get(fileName) ?? { mtimeMs: Date.now(), size: 0 };
      const createdAt = parseTimestampFromFileName(fileName, stat.mtimeMs);
      insertVideo.run(
        id,
        fileName,
        null,
        '(recovered)',
        'unknown',
        null,
        null,
        0,
        stat.size,
        contentTypeFromExt(ext),
        null,
        null,
        createdAt,
        recoveredFolderId
      );
    }
  });
  txn();

  log.info('Reconciled orphan video files into Recovered folder', {
    orphanCount: orphans.length,
    folderId: recoveredFolderId,
  });
}
