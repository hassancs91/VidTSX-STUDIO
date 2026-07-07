import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import {
  getDb,
  getThumbnailPath as getCentralThumbnailPath,
  getThumbnailsDir,
} from './creator-db';

const log = logEngine.createLogger('creator-migrate');

/**
 * Legacy sidecar locations: `{basename}.push-draft.json` and `{basename}.push-thumb.webp`
 * lived alongside the user's TSX file. We can't bulk-walk the filesystem because
 * TSX files live in arbitrary project folders, so migration is per-file and
 * triggered lazily on first load.
 */
function legacyDraftPath(tsxFilePath: string): string {
  const dir = path.dirname(tsxFilePath);
  const base = path.basename(tsxFilePath, '.tsx');
  return path.join(dir, `${base}.push-draft.json`);
}

function legacyThumbnailPath(tsxFilePath: string): string {
  const dir = path.dirname(tsxFilePath);
  const base = path.basename(tsxFilePath, '.tsx');
  return path.join(dir, `${base}.push-thumb.webp`);
}

interface LegacyDraft {
  title?: unknown;
  slug?: unknown;
  slugEdited?: unknown;
  description?: unknown;
  tags?: unknown;
  isPremium?: unknown;
  featured?: unknown;
  updatedAt?: unknown;
  pushedAt?: unknown;
  templateId?: unknown;
  templateUrl?: unknown;
}

function sanitizeLegacy(parsed: LegacyDraft): {
  title: string;
  slug: string;
  slugEdited: number;
  description: string;
  tags: string;
  isPremium: number;
  featured: number;
  updatedAt: string;
  pushedAt: string | null;
  templateId: string | null;
  templateUrl: string | null;
} {
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string')
    : [];
  return {
    title: typeof parsed.title === 'string' ? parsed.title : '',
    slug: typeof parsed.slug === 'string' ? parsed.slug : '',
    slugEdited: parsed.slugEdited === true ? 1 : 0,
    description: typeof parsed.description === 'string' ? parsed.description : '',
    tags: JSON.stringify(tags),
    isPremium: parsed.isPremium === true ? 1 : 0,
    featured: parsed.featured === true ? 1 : 0,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    pushedAt: typeof parsed.pushedAt === 'string' ? parsed.pushedAt : null,
    templateId: typeof parsed.templateId === 'string' ? parsed.templateId : null,
    templateUrl: typeof parsed.templateUrl === 'string' ? parsed.templateUrl : null,
  };
}

/**
 * Import a legacy sidecar draft + thumbnail for a single TSX into SQLite.
 * Idempotent: silently no-ops when no sidecar exists or when the DB already
 * has a row for this path. Returns true iff a draft was imported in this call.
 */
export async function importLegacyDraftForTsx(tsxFilePath: string): Promise<boolean> {
  const db = getDb();
  const existing = db
    .prepare('SELECT 1 FROM push_drafts WHERE tsx_file_path = ?')
    .get(tsxFilePath);
  if (existing) return false;

  const draftFile = legacyDraftPath(tsxFilePath);
  let raw: string;
  try {
    raw = await fs.readFile(draftFile, 'utf-8');
  } catch {
    return false; // no sidecar to import
  }

  let parsed: LegacyDraft;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.warn('Legacy push-draft is not valid JSON — skipping', {
      draftFile,
      err: err instanceof Error ? err.message : String(err),
    });
    await backupFile(draftFile);
    return false;
  }

  const fields = sanitizeLegacy(parsed);
  db.prepare(
    `INSERT OR IGNORE INTO push_drafts
       (tsx_file_path, title, slug, slug_edited, description, tags, is_premium, featured,
        updated_at, pushed_at, template_id, template_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    tsxFilePath,
    fields.title,
    fields.slug,
    fields.slugEdited,
    fields.description,
    fields.tags,
    fields.isPremium,
    fields.featured,
    fields.updatedAt,
    fields.pushedAt,
    fields.templateId,
    fields.templateUrl
  );

  await moveLegacyThumbnail(tsxFilePath);
  await backupFile(draftFile);

  log.info('Imported legacy push draft into SQLite', { tsxFilePath });
  return true;
}

async function moveLegacyThumbnail(tsxFilePath: string): Promise<void> {
  const legacy = legacyThumbnailPath(tsxFilePath);
  try {
    await fs.access(legacy);
  } catch {
    return; // no thumbnail to move
  }

  const target = getCentralThumbnailPath(tsxFilePath);
  try {
    await fs.mkdir(getThumbnailsDir(), { recursive: true });
    // Copy-then-unlink so we survive cross-volume scenarios where rename fails.
    await fs.copyFile(legacy, target);
    await fs.unlink(legacy);
  } catch (err) {
    log.warn('Failed to migrate legacy push thumbnail', {
      legacy,
      target,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy push-draft to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
