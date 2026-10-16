// Import TSX of a TSX builder version (TSX_BUILDER_DESIGN.md P3 part 6, Hasan's
// 1a + 3a): what travels into the new shot's folder beside its v1.tsx.
//
// - The files a shot cannot register as project media (3D models, environment
//   maps, fonts, data: everything attachVersionMedia leaves out) are COPIED
//   into `v1.assets/`, keeping their path, so the shot plays them from its own
//   folder (D8) and they move with it. A `.gltf` brings the `.bin` and textures
//   it names. Images, video and audio stay registered in place, as before.
// - The builder's own source and record: `vN.src/` → `v1.src/` and
//   `vN.debug.json` → `v1.debug.json`, so an edit of the shot continues from
//   the real source files (build-seed.ts seed `src`: v1.tsx is the same bytes,
//   so the record's artifactSha256 still matches) instead of a 2-3 MB bundle.
//   Local to local, so no privacy question; the record keeps format + loop.

import fs from 'fs/promises';
import path from 'path';
import { versionAssetFiles } from '../tsx-builder/version-assets';
import { classifyMediaKind } from './media-import';

export interface CarriedFiles {
  /** Paths inside `v1.assets/` (POSIX) that were copied. */
  copied: string[];
  /** `vN.src/` was copied to `v1.src/`. */
  source: boolean;
  /** `vN.debug.json` was copied to `v1.debug.json`. */
  record: boolean;
}

async function isDir(p: string): Promise<boolean> {
  return fs.stat(p).then((s) => s.isDirectory(), () => false);
}

async function isFile(p: string): Promise<boolean> {
  return fs.stat(p).then((s) => s.isFile(), () => false);
}

/** The relative files a `.gltf` names (buffers and images), as POSIX paths beside it; data: URIs and anything outside skipped. */
async function gltfCompanions(dir: string, relPath: string): Promise<string[]> {
  try {
    const gltf = JSON.parse(await fs.readFile(path.join(dir, ...relPath.split('/')), 'utf-8')) as {
      buffers?: Array<{ uri?: unknown }>;
      images?: Array<{ uri?: unknown }>;
    };
    const base = path.posix.dirname(relPath);
    return [...(gltf.buffers ?? []), ...(gltf.images ?? [])]
      .map((entry) => entry.uri)
      .filter((uri): uri is string => typeof uri === 'string' && !/^[a-z]+:/i.test(uri) && !uri.startsWith('/'))
      .map((uri) => path.posix.normalize(path.posix.join(base, decodeURIComponent(uri))))
      .filter((rel) => !rel.startsWith('..'));
  } catch {
    return [];
  }
}

/**
 * Carry a builder version's non-media files, source and record from
 * `sourcePath` (a `vN.tsx`, or any `.tsx` with `<name>.assets/` beside it) into
 * the shot folder whose new version is `versionPath`. Nothing for a source
 * that names no files and has no sidecars.
 */
export async function carryBuilderFiles(sourcePath: string, code: string, versionPath: string): Promise<CarriedFiles> {
  const folder = path.dirname(versionPath);
  const base = path.basename(versionPath, path.extname(versionPath));
  const targetAssets = path.join(folder, `${base}.assets`);
  const copied: string[] = [];
  const copy = async (dir: string, rel: string): Promise<void> => {
    if (copied.includes(rel)) return;
    const from = path.join(dir, ...rel.split('/'));
    if (!(await isFile(from))) return;
    const to = path.join(targetAssets, ...rel.split('/'));
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
    copied.push(rel);
  };
  for (const file of await versionAssetFiles(sourcePath, code)) {
    if (!file.dir || !file.path || classifyMediaKind(file.path) !== null) continue;
    await copy(file.dir, file.relPath);
    if (path.extname(file.relPath).toLowerCase() === '.gltf') {
      for (const rel of await gltfCompanions(file.dir, file.relPath)) await copy(file.dir, rel);
    }
  }

  const sourceBase = path.join(path.dirname(sourcePath), path.basename(sourcePath, path.extname(sourcePath)));
  const source = await isDir(`${sourceBase}.src`);
  if (source) await fs.cp(`${sourceBase}.src`, path.join(folder, `${base}.src`), { recursive: true });
  const record = await isFile(`${sourceBase}.debug.json`);
  if (record) await fs.copyFile(`${sourceBase}.debug.json`, path.join(folder, `${base}.debug.json`));
  return { copied, source, record };
}
