// Copying a composition somewhere else (P3 part 4). A builder version is more
// than its `vN.tsx`: `vN.src/` is what an edit continues, `vN.assets/` holds
// the files the code loads (a piece without them plays blanks), and
// `vN.debug.json` is its build record. Every place that hands a composition on
// copies through here: run_agent's context in and output out, a flow run's
// outputs, Save to Library (tool + stage action) and Open in Creator.
//
// A copy lands in its own `<parent>/<slug>/` folder, so two versions that are
// both called `v1.tsx` never collide. An older session's flat
// `compositions/<slug>.tsx` has no sidecars and is copied alone.

import fs from 'fs/promises';
import path from 'path';
import { versionAssetFiles } from '../tsx-builder/version-assets';
import { reserveFolder } from './tools/workspace-files';

const VERSION_FILE = /^v\d+\.tsx$/i;

async function exists(p: string): Promise<boolean> {
  return fs.stat(p).then(
    () => true,
    () => false,
  );
}

/** `vN.tsx` → its sidecars (`vN.src/`, `vN.debug.json`) beside it. */
function sidecarsOf(tsxPath: string): string[] {
  const dir = path.dirname(tsxPath);
  const base = path.basename(tsxPath, path.extname(tsxPath));
  return [path.join(dir, `${base}.src`), path.join(dir, `${base}.debug.json`)];
}

/**
 * The files `tsxPath`'s code loads, into `destAssetsDir`: its own
 * `<base>.assets/` when it has one, else each file found where the version's
 * player would find it (an earlier version's folder). Nothing when the code
 * loads no files. Returns whether anything was copied.
 */
export async function copyVersionAssets(tsxPath: string, destAssetsDir: string): Promise<boolean> {
  const own = path.join(path.dirname(tsxPath), `${path.basename(tsxPath, path.extname(tsxPath))}.assets`);
  await fs.rm(destAssetsDir, { recursive: true, force: true });
  if (await exists(own)) {
    await fs.cp(own, destAssetsDir, { recursive: true });
    return true;
  }
  const found = (await versionAssetFiles(tsxPath)).filter((f) => f.path);
  for (const file of found) {
    const target = path.join(destAssetsDir, ...file.relPath.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file.path!, target);
  }
  return found.length > 0;
}

/** The slug a copy's folder is named after: the version folder's name, or a flat file's stem. */
export function compositionSlug(tsxPath: string): string {
  return VERSION_FILE.test(path.basename(tsxPath))
    ? path.basename(path.dirname(tsxPath))
    : path.basename(tsxPath, path.extname(tsxPath));
}

/**
 * Copy one version into a fresh `<destParentRel>/<slug>/` inside `destWorkspace`
 * and return its workspace-relative path (`context/promo/v2.tsx`). The file
 * keeps its name; a builder version brings `vN.src/`, `vN.assets/` and
 * `vN.debug.json`.
 */
export async function copyCompositionVersion(
  srcTsx: string,
  destWorkspace: string,
  destParentRel: string,
): Promise<string> {
  const folder = await reserveFolder(destWorkspace, destParentRel, compositionSlug(srcTsx), 'composition');
  const name = path.basename(srcTsx);
  await fs.copyFile(srcTsx, path.join(folder.absDir, name));
  if (VERSION_FILE.test(name)) {
    for (const sidecar of sidecarsOf(srcTsx)) {
      if (await exists(sidecar)) await fs.cp(sidecar, path.join(folder.absDir, path.basename(sidecar)), { recursive: true });
    }
  }
  await copyVersionAssets(srcTsx, path.join(folder.absDir, `${path.basename(name, path.extname(name))}.assets`));
  return `${folder.relDir}/${name}`;
}

/**
 * A composition's WHOLE folder into `destFolder` (which must not exist yet or
 * be empty): every version, its sources, files, stills and `chat.json`, so the
 * Creator opens the project with its history. Returns the copied `tsxPath`. A
 * flat legacy file becomes `v1.tsx` alone, as it always did.
 */
export async function copyCompositionFolder(srcTsx: string, destFolder: string): Promise<string> {
  const name = path.basename(srcTsx);
  if (!VERSION_FILE.test(name)) {
    const target = path.join(destFolder, 'v1.tsx');
    await fs.mkdir(destFolder, { recursive: true });
    await fs.copyFile(srcTsx, target);
    return target;
  }
  await fs.cp(path.dirname(srcTsx), destFolder, { recursive: true });
  return path.join(destFolder, name);
}
