// Where a tool's work files land inside a session workspace.
//
// The MODEL never names a file (plan §1.4): it gives a title, the app slugs it
// and adds a counter until the name is free. Everything here returns a path
// relative to the workspace root, which is what an artifact payload stores.

import fs from 'fs/promises';
import path from 'path';

const SLUG_MAX = 48;

/** Filesystem-safe kebab slug; mirrors the library's rule, own copy so the
 *  agents feature does not depend on library filing for its work files. */
export function slugifyName(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : fallback;
}

/**
 * Reserve `<folder>/<slug><ext>`, then `-2`, `-3`, … inside the workspace.
 * The folder is created; the file is not — the caller writes it.
 */
export async function reserveWorkspaceFile(
  workspaceDir: string,
  folder: string,
  title: string,
  ext: string,
  fallback: string,
): Promise<{ relPath: string; absPath: string }> {
  const base = slugifyName(title, fallback);
  const folderAbs = path.join(workspaceDir, folder);
  await fs.mkdir(folderAbs, { recursive: true });
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? `${base}${ext}` : `${base}-${n}${ext}`;
    const absPath = path.join(folderAbs, name);
    try {
      await fs.access(absPath);
    } catch {
      return { relPath: `${folder}/${name}`, absPath };
    }
  }
}

/** Read a workspace-relative file. The path comes from an artifact payload,
 *  which the store already checked for containment. */
export function readWorkspaceFile(workspaceDir: string, relPath: string): Promise<string> {
  return fs.readFile(path.join(workspaceDir, relPath), 'utf-8');
}
