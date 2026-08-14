// Filing rules for born-managed library content (D12 / L5-L6): where a
// generated image or webpage capture lands and what it gets named. The pure
// parts (slugs, folders, descriptions) are exported for tests; only
// reserveLibraryFile touches the disk.

import path from 'path';
import fs from 'fs/promises';
import { resolveLibraryPath } from './library-paths';

/** Default folder for generate_image output (L5). */
export const GENERATED_FOLDER = 'generated';
/** Root folder for capture_webpage output (L6): captures/<domain>/. */
export const CAPTURES_FOLDER = 'captures';

const SLUG_MAX = 40;

/** Filesystem-safe kebab slug of free text (prompt, page title). */
export function slugify(text: string, fallback = 'asset'): string {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : fallback;
}

/** A folder name from a page URL's host — `captures/learnwithhasan.com/`.
 *  Ports and `www.` are dropped; anything unparsable files under `pages`. */
export function domainFolder(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const safe = host.replace(/[^a-z0-9.-]/gi, '-');
    return `${CAPTURES_FOLDER}/${safe.length > 0 ? safe : 'pages'}`;
  } catch {
    return `${CAPTURES_FOLDER}/pages`;
  }
}

/** Capture description default (L6): page title + URL. */
export function captureDescription(title: string, url: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? `${trimmed} — ${url}` : url;
}

/** A folder argument sanitized to a library-relative folder path (POSIX
 *  separators, no dot segments); empty/invalid input falls back. */
export function sanitizeFolder(folder: string | undefined, fallback: string): string {
  if (!folder) return fallback;
  const parts = folder
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== '.' && p !== '..' && !p.startsWith('.'));
  return parts.length > 0 ? parts.join('/') : fallback;
}

/**
 * Reserve a non-colliding file path inside the library: `<folder>/<base><ext>`,
 * then `<base>-2<ext>`, `-3`, … The folder is created; the file is NOT — the
 * caller writes it, then registers it via upsertEntry.
 */
export async function reserveLibraryFile(
  root: string,
  folderRel: string,
  baseName: string,
  ext: string,
): Promise<{ relPath: string; absPath: string }> {
  const folderAbs = resolveLibraryPath(root, folderRel);
  await fs.mkdir(folderAbs, { recursive: true });
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${baseName}${ext}` : `${baseName}-${n}${ext}`;
    const relPath = `${folderRel}/${name}`;
    const absPath = path.join(folderAbs, name);
    try {
      await fs.access(absPath);
    } catch {
      return { relPath, absPath };
    }
  }
}
