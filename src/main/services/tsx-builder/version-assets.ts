// A saved version's files, for whoever plays or exports it (TSX_BUILDER_DESIGN.md
// P2 part 4). A builder version `vN.tsx` loads its files through the `assets`
// prop (`__vidtsxAsset('robot.glb')` after the bundle step); the files sit in
// `vN.assets/`. The Creator preview, the Creator export, a flow's render and the
// Studio import all call this to turn the names in the code into files and URLs.
//
// A name not in the version's own `.assets/` is looked up in the earlier
// versions' folders, newest first: a version the Creator writes from a builder
// version (Save as new, Apply, Fix with AI) carries the same code and no
// folder of its own, and must still play.

import fs from 'fs/promises';
import path from 'path';
import { assetRootUrl } from '../asset-roots';
import { assetKindOf, assetRefsInArtifact, type AssetKind } from './build-assets';

const VERSION_FILE = /^v(\d+)\.tsx$/i;

export interface VersionAssetFile {
  /** The `assets` prop key the code looks up. */
  key: string;
  /** POSIX path inside the assets folder. */
  relPath: string;
  kind: AssetKind | null;
  /** The `.assets/` folder that holds it, or null when no folder has it. */
  dir: string | null;
  /** The file on disk, or null when no folder has it. */
  path: string | null;
}

async function isFile(p: string): Promise<boolean> {
  return fs.stat(p).then(
    (s) => s.isFile(),
    () => false,
  );
}

/** Where to look, in order: `<base>.assets/`, then `vK.assets/` newest first (K below N for a `vN.tsx`). */
async function candidateDirs(tsxPath: string): Promise<string[]> {
  const folder = path.dirname(tsxPath);
  const base = path.basename(tsxPath, path.extname(tsxPath));
  const own = path.join(folder, `${base}.assets`);
  const n = VERSION_FILE.exec(path.basename(tsxPath));
  const entries = await fs.readdir(folder).catch(() => [] as string[]);
  const earlier = entries
    .map((e) => /^v(\d+)\.assets$/i.exec(e))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .filter((k) => (n ? k < Number(n[1]) : true))
    .sort((a, b) => b - a)
    .map((k) => path.join(folder, `v${k}.assets`))
    .filter((dir) => path.resolve(dir) !== path.resolve(own));
  return [own, ...earlier];
}

/**
 * Every file the version's code names, found on disk where possible. `code`
 * defaults to the file's own text. Empty when the code names no files (every
 * version made before P2 part 4, and every piece that draws only in code).
 */
export async function versionAssetFiles(tsxPath: string, code?: string): Promise<VersionAssetFile[]> {
  const text = code ?? (await fs.readFile(tsxPath, 'utf-8').catch(() => ''));
  const refs = assetRefsInArtifact(text);
  const keys = Object.keys(refs);
  if (keys.length === 0) return [];
  const dirs = await candidateDirs(tsxPath);
  const out: VersionAssetFile[] = [];
  for (const key of keys) {
    const relPath = refs[key];
    let found: { dir: string; path: string } | null = null;
    for (const dir of dirs) {
      const candidate = path.join(dir, ...relPath.split('/'));
      if (await isFile(candidate)) {
        found = { dir, path: candidate };
        break;
      }
    }
    out.push({ key, relPath, kind: assetKindOf(relPath), dir: found?.dir ?? null, path: found?.path ?? null });
  }
  return out;
}

/**
 * The `assets` prop for a page that loads from `origin` (the module server for
 * the preview, the bundle server for a render), or null when the code names no
 * files. A file no folder has is left out: the piece sees '' for it, as it
 * would anywhere else.
 */
export async function versionAssetsProp(tsxPath: string, origin: string, code?: string): Promise<Record<string, string> | null> {
  const files = await versionAssetFiles(tsxPath, code);
  if (files.length === 0) return null;
  const prop: Record<string, string> = {};
  for (const f of files) {
    if (f.dir) prop[f.key] = assetRootUrl(origin, f.dir, f.relPath);
  }
  return prop;
}

/** `inputProps` with the version's `assets` merged in (the version's files win over a stale `assets` value). */
export async function withVersionAssets(
  tsxPath: string,
  origin: string | null,
  inputProps: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> {
  if (!origin) return inputProps;
  const assets = await versionAssetsProp(tsxPath, origin).catch(() => null);
  if (!assets) return inputProps;
  const given = inputProps?.assets && typeof inputProps.assets === 'object' ? (inputProps.assets as Record<string, unknown>) : {};
  return { ...(inputProps ?? {}), assets: { ...given, ...assets } };
}
