import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logEngine } from '../../logging/log-engine';
import { getImagesDir, getReferencesDir, getStudioDir } from './image-studio-files';
import { getDb } from './image-studio-db';

const log = logEngine.createLogger('image-studio-migrate');

interface LegacyImage {
  id: string;
  fileName: string;
  prompt: string;
  model: string;
  width: number | null;
  height: number | null;
  contentType: string;
  createdAt: number;
  durationMs?: number;
  folderId?: string | null;
}

interface LegacyFolder {
  id: string;
  name: string;
  createdAt: number;
}

interface LegacyReference {
  id: string;
  fileName: string;
  originalName: string;
  contentType: string;
  createdAt: number;
  enabled: boolean;
}

interface LegacyManifest {
  folders: unknown[];
  images: unknown[];
  references: unknown[];
}

function isLegacyImage(e: unknown): e is LegacyImage {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.fileName === 'string' &&
    typeof o.prompt === 'string' &&
    typeof o.model === 'string' &&
    (typeof o.width === 'number' || o.width === null) &&
    (typeof o.height === 'number' || o.height === null) &&
    typeof o.contentType === 'string' &&
    typeof o.createdAt === 'number'
  );
}

function isLegacyFolder(f: unknown): f is LegacyFolder {
  if (typeof f !== 'object' || f === null) return false;
  const o = f as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.createdAt === 'number';
}

function isLegacyReference(r: unknown): r is LegacyReference {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.fileName === 'string' &&
    typeof o.originalName === 'string' &&
    typeof o.contentType === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.enabled === 'boolean'
  );
}

function contentTypeFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.webp') return 'image/webp';
  return 'image/png';
}

/** Parse `img-{timestamp}-{shortId}.ext` → timestamp, else falls back to the file mtime. */
function parseTimestampFromFileName(fileName: string, fallback: number): number {
  const match = fileName.match(/^img-(\d+)-/);
  if (match) {
    const ts = Number(match[1]);
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  return fallback;
}

/**
 * One-shot migration + reconciliation. Safe to call on every launch.
 *
 *  1. If legacy manifest.json exists AND the DB has no data, import its contents.
 *  2. Rename the manifest to a backup so we never re-import (but we keep the file).
 *  3. Reconcile: any file on disk under images/ that isn't in the DB gets re-added
 *     with placeholder metadata inside an auto-created "Recovered" folder.
 */
export async function migrateImageStudio(): Promise<void> {
  try {
    await fs.mkdir(getStudioDir(), { recursive: true });
    await fs.mkdir(getImagesDir(), { recursive: true });
    await fs.mkdir(getReferencesDir(), { recursive: true });
  } catch (err) {
    log.error('Failed to ensure image-studio directories', err);
    return;
  }

  const db = getDb();

  await importLegacyManifest(db);
  await reconcileOrphans(db);
}

async function importLegacyManifest(db: import('better-sqlite3').Database): Promise<void> {
  const manifestPath = path.join(getStudioDir(), 'manifest.json');

  let rawContent: string;
  try {
    rawContent = await fs.readFile(manifestPath, 'utf-8');
  } catch {
    // No manifest — nothing to import (fresh install or already migrated).
    return;
  }

  // Only import if DB is empty; otherwise assume a prior migration already happened.
  const imageCount = (db.prepare('SELECT COUNT(*) as n FROM images').get() as { n: number }).n;
  const folderCount = (db.prepare('SELECT COUNT(*) as n FROM folders').get() as { n: number }).n;
  const refCount = (db.prepare('SELECT COUNT(*) as n FROM reference_images').get() as { n: number }).n;

  if (imageCount > 0 || folderCount > 0 || refCount > 0) {
    // Safety: DB already has data but manifest wasn't renamed. Rename it now so we don't
    // reimport on next launch.
    await renameLegacyManifest(manifestPath);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    log.error('Legacy manifest.json is not valid JSON — skipping import', err);
    await renameLegacyManifest(manifestPath);
    return;
  }

  // Handle old format (bare array of images) as well as the current object shape.
  let folders: LegacyFolder[] = [];
  let images: LegacyImage[] = [];
  let references: LegacyReference[] = [];

  if (Array.isArray(parsed)) {
    images = parsed.filter(isLegacyImage);
  } else if (typeof parsed === 'object' && parsed !== null) {
    const m = parsed as LegacyManifest;
    folders = Array.isArray(m.folders) ? m.folders.filter(isLegacyFolder) : [];
    images = Array.isArray(m.images) ? m.images.filter(isLegacyImage) : [];
    references = Array.isArray(m.references) ? m.references.filter(isLegacyReference) : [];
  }

  const insertFolder = db.prepare(
    'INSERT OR IGNORE INTO folders (id, name, created_at) VALUES (?, ?, ?)'
  );
  const insertImage = db.prepare(
    `INSERT OR IGNORE INTO images
       (id, file_name, prompt, model, width, height, content_type, created_at, duration_ms, folder_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertRef = db.prepare(
    `INSERT OR IGNORE INTO reference_images
       (id, file_name, original_name, content_type, created_at, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const txn = db.transaction(() => {
    for (const f of folders) {
      insertFolder.run(f.id, f.name, f.createdAt);
    }
    for (const img of images) {
      insertImage.run(
        img.id,
        img.fileName,
        img.prompt,
        img.model,
        img.width,
        img.height,
        img.contentType,
        img.createdAt,
        img.durationMs ?? 0,
        img.folderId ?? null
      );
    }
    for (const r of references) {
      insertRef.run(r.id, r.fileName, r.originalName, r.contentType, r.createdAt, r.enabled ? 1 : 0);
    }
  });
  txn();

  log.info('Imported legacy manifest into SQLite', {
    folders: folders.length,
    images: images.length,
    references: references.length,
  });

  await renameLegacyManifest(manifestPath);
}

async function renameLegacyManifest(manifestPath: string): Promise<void> {
  const backupPath = `${manifestPath}.backup-${Date.now()}`;
  try {
    await fs.rename(manifestPath, backupPath);
    log.info('Backed up legacy manifest', { backupPath });
  } catch (err) {
    log.warn('Failed to rename legacy manifest to backup', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function reconcileOrphans(db: import('better-sqlite3').Database): Promise<void> {
  let files: string[];
  try {
    files = await fs.readdir(getImagesDir());
  } catch {
    return;
  }

  const validExt = (f: string) => /\.(png|jpe?g|webp)$/i.test(f);
  const onDisk = files.filter(validExt);
  if (onDisk.length === 0) return;

  const knownRows = db.prepare('SELECT file_name FROM images').all() as { file_name: string }[];
  const known = new Set(knownRows.map((r) => r.file_name));

  const orphans = onDisk.filter((f) => !known.has(f));
  if (orphans.length === 0) return;

  // Auto-create "Recovered" folder once (reuse if user has deleted it and we run again —
  // we identify by name to avoid duplicates on repeat runs).
  const existingRecovered = db
    .prepare("SELECT id FROM folders WHERE name = 'Recovered' LIMIT 1")
    .get() as { id: string } | undefined;
  const recoveredFolderId = existingRecovered?.id ?? crypto.randomUUID();

  const insertFolder = db.prepare(
    'INSERT OR IGNORE INTO folders (id, name, created_at) VALUES (?, ?, ?)'
  );
  const insertImage = db.prepare(
    `INSERT INTO images
       (id, file_name, prompt, model, width, height, content_type, created_at, duration_ms, folder_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Stat fallback for timestamp when filename doesn't carry one.
  const statsByName = new Map<string, number>();
  for (const f of orphans) {
    try {
      const s = await fs.stat(path.join(getImagesDir(), f));
      statsByName.set(f, s.mtimeMs);
    } catch {
      statsByName.set(f, Date.now());
    }
  }

  const txn = db.transaction(() => {
    if (!existingRecovered) {
      insertFolder.run(recoveredFolderId, 'Recovered', Date.now());
    }

    for (const fileName of orphans) {
      const id = crypto.randomUUID();
      const ext = path.extname(fileName);
      const createdAt = parseTimestampFromFileName(fileName, statsByName.get(fileName) ?? Date.now());
      insertImage.run(
        id,
        fileName,
        '(recovered)',
        'unknown',
        null,
        null,
        contentTypeFromExt(ext),
        createdAt,
        0,
        recoveredFolderId
      );
    }
  });
  txn();

  log.info('Reconciled orphan image files into Recovered folder', {
    orphanCount: orphans.length,
    folderId: recoveredFolderId,
  });
}
