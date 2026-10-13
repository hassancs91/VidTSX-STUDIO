// The builder's files (TSX_BUILDER_DESIGN.md P2 part 4): an `assets/` folder in
// the build's work folder. A piece names a file with `staticFile('robot.glb')`
// (its path inside assets/); the bundle step turns every literal staticFile()
// into a lookup in the `assets` prop (shot-bundle-finish.ts), so whoever plays
// or renders the piece hands it `assets = { <key>: <url> }`. Here:
//
// - `resolveBuildAssets`: what `check` runs on the bundle's staticFile() refs:
//   each must name a file in assets/ of a kind the renderer serves, two refs
//   must not share a lookup key, and a model or environment file must load
//   offline (no Draco, no KTX2; a .gltf's buffers and images beside it).
// - `assetsProp`: the prop for a render or a preview, as asset-root URLs
//   (asset-roots.ts) on the server that will load it.
// - `listAssetFiles`: what the folder holds, for the builder's first message.
//
// The folder is saved with the version as `vN.assets/` (build-store.ts) and is
// never part of `vN.src/`.

import fs from 'fs/promises';
import path from 'path';
import { shotAssetKey } from '../studio/shot-bundle-finish';
import { assetRootUrl, ASSET_ROOT_EXTENSIONS } from '../asset-roots';
import { ASSETS_DIR } from './constants';

export { ASSETS_DIR };

export type AssetKind = 'image' | 'video' | 'audio' | 'model' | 'environment' | 'font' | 'data';

const KIND_BY_EXT: Record<string, AssetKind> = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image', '.avif': 'image', '.svg': 'image', '.bmp': 'image',
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.m4v': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.ogg': 'audio', '.aac': 'audio', '.opus': 'audio', '.flac': 'audio',
  '.glb': 'model', '.gltf': 'model', '.bin': 'model',
  '.hdr': 'environment', '.exr': 'environment',
  '.ttf': 'font', '.otf': 'font', '.woff': 'font', '.woff2': 'font',
  '.json': 'data', '.csv': 'data', '.txt': 'data',
};

/** The kind of a file the renderer can serve, or null. */
export function assetKindOf(file: string): AssetKind | null {
  const ext = path.extname(file).toLowerCase();
  return ASSET_ROOT_EXTENSIONS.has(ext) ? (KIND_BY_EXT[ext] ?? null) : null;
}

export interface BuildAsset {
  /** The staticFile() argument as written. */
  ref: string;
  /** The `assets` prop key the bundled code looks up (shotAssetKey). */
  key: string;
  /** POSIX path inside assets/. */
  relPath: string;
  kind: AssetKind;
  bytes: number;
}

export interface AssetFile {
  relPath: string;
  kind: AssetKind | null;
  bytes: number;
}

/** Every file under `assetsDir` (recursive, POSIX paths, sorted); [] when it does not exist. */
export async function listAssetFiles(assetsDir: string): Promise<AssetFile[]> {
  const out: AssetFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        const relPath = path.relative(assetsDir, abs).split(path.sep).join('/');
        out.push({ relPath, kind: assetKindOf(relPath), bytes: stat.size });
      }
    }
  };
  await walk(assetsDir);
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SERVED_KINDS =
  'images (.png .jpg .webp .gif .svg .avif), video (.mp4 .webm .mov), audio (.mp3 .wav .m4a .ogg), models (.glb, or .gltf with its .bin and textures), environment maps (.hdr .exr), fonts (.ttf .otf .woff .woff2), data (.json .csv .txt)';

/** glTF extensions whose decoders download at render (no network then) or are not set up. */
const UNLOADABLE_GLTF_EXTENSIONS: Record<string, string> = {
  KHR_draco_mesh_compression: 'Draco compression needs a decoder downloaded at render time; re-export without Draco (meshopt compression, EXT_meshopt_compression, loads offline)',
  KHR_texture_basisu: 'KTX2/Basis textures need a transcoder downloaded at render time; re-export with PNG/JPEG/WebP textures',
};

interface GltfJson {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  buffers?: Array<{ uri?: string }>;
  images?: Array<{ uri?: string }>;
}

async function readGlbJson(file: string): Promise<GltfJson> {
  const handle = await fs.open(file, 'r');
  try {
    const head = Buffer.alloc(20);
    await handle.read(head, 0, 20, 0);
    if (head.readUInt32LE(0) !== 0x46546c67) throw new Error('not a binary glTF (no "glTF" magic)');
    if (head.readUInt32LE(4) !== 2) throw new Error(`glTF version ${head.readUInt32LE(4)}, only 2 loads`);
    const jsonLength = head.readUInt32LE(12);
    if (head.readUInt32LE(16) !== 0x4e4f534a) throw new Error('the first chunk is not JSON');
    const json = Buffer.alloc(jsonLength);
    await handle.read(json, 0, jsonLength, 20);
    return JSON.parse(json.toString('utf-8')) as GltfJson;
  } finally {
    await handle.close();
  }
}

/** Why a model or environment file would not load offline, or null. */
export async function lintAssetFile(assetsDir: string, relPath: string): Promise<string | null> {
  const file = path.join(assetsDir, ...relPath.split('/'));
  const ext = path.extname(relPath).toLowerCase();
  try {
    if (ext === '.glb' || ext === '.gltf') {
      const gltf = ext === '.glb' ? await readGlbJson(file) : (JSON.parse(await fs.readFile(file, 'utf-8')) as GltfJson);
      const used = new Set([...(gltf.extensionsUsed ?? []), ...(gltf.extensionsRequired ?? [])]);
      for (const [name, why] of Object.entries(UNLOADABLE_GLTF_EXTENSIONS)) {
        if (used.has(name)) return `${relPath}: ${why}.`;
      }
      if (ext === '.gltf') {
        const dir = path.posix.dirname(relPath);
        const uris = [...(gltf.buffers ?? []), ...(gltf.images ?? [])]
          .map((b) => b.uri)
          .filter((u): u is string => typeof u === 'string' && !u.startsWith('data:'));
        for (const uri of uris) {
          if (/^[a-z]+:/i.test(uri) || uri.startsWith('/')) return `${relPath}: it references "${uri}", which is not a file beside it (only relative files and data: URIs load offline).`;
          const target = path.posix.normalize(path.posix.join(dir, decodeURIComponent(uri)));
          if (target.startsWith('..')) return `${relPath}: "${uri}" points outside assets/.`;
          const exists = await fs.stat(path.join(assetsDir, ...target.split('/'))).then((s) => s.isFile(), () => false);
          if (!exists) return `${relPath}: "${uri}" is missing from assets/ (a .gltf needs its .bin and textures beside it; a .glb carries them inside).`;
          if (!assetKindOf(target)) return `${relPath}: "${uri}" is not a file kind the renderer serves.`;
        }
      }
      return null;
    }
    if (ext === '.hdr') {
      const handle = await fs.open(file, 'r');
      const head = Buffer.alloc(10);
      try {
        await handle.read(head, 0, 10, 0);
      } finally {
        await handle.close();
      }
      const magic = head.toString('latin1');
      return magic.startsWith('#?RADIANCE') || magic.startsWith('#?RGBE') ? null : `${relPath}: not a Radiance .hdr file (no "#?RADIANCE" header).`;
    }
    if (ext === '.exr') {
      const handle = await fs.open(file, 'r');
      const head = Buffer.alloc(4);
      try {
        await handle.read(head, 0, 4, 0);
      } finally {
        await handle.close();
      }
      return head.readUInt32LE(0) === 0x01312f76 ? null : `${relPath}: not an OpenEXR file.`;
    }
    return null;
  } catch (err) {
    return `${relPath}: could not be read as ${ext} (${err instanceof Error ? err.message : String(err)}).`;
  }
}

function listForError(files: AssetFile[]): string {
  if (files.length === 0) return 'assets/ is empty';
  const shown = files.slice(0, 20).map((f) => f.relPath);
  return `assets/ holds: ${shown.join(', ')}${files.length > shown.length ? `, … (${files.length} files)` : ''}`;
}

export interface ResolvedBuildAssets {
  assets: BuildAsset[];
  /** Verbatim, for the model to act on. */
  errors: string[];
}

/**
 * The bundle's literal staticFile() refs against `assetsDir`. `dynamicCalls`:
 * staticFile() calls whose argument is not a plain string (they cannot be
 * resolved, so the piece would draw nothing there).
 */
export async function resolveBuildAssets(assetsDir: string, refs: string[], dynamicCalls = 0): Promise<ResolvedBuildAssets> {
  const errors: string[] = [];
  if (dynamicCalls > 0) {
    errors.push(
      `staticFile() takes a plain string literal: ${dynamicCalls} call(s) build the name at run time, so the file cannot be found or shipped. Write each name out (a lookup object { a: staticFile('a.png'), … } is fine).`,
    );
  }
  if (refs.length === 0) return { assets: [], errors };

  const files = await listAssetFiles(assetsDir);
  const byPath = new Map(files.map((f) => [f.relPath, f]));
  const assets: BuildAsset[] = [];
  const keys = new Map<string, string>();
  for (const ref of refs) {
    const relPath = ref.replace(/\\/g, '/').replace(/^\.?\/+/, '');
    if (/^[a-zA-Z]:/.test(ref) || relPath.split('/').includes('..')) {
      errors.push(`staticFile('${ref}'): name a file by its path INSIDE assets/, e.g. staticFile('model.glb') for assets/model.glb.`);
      continue;
    }
    const file = byPath.get(relPath);
    if (!file) {
      const hint = relPath.startsWith(`${ASSETS_DIR}/`) && byPath.has(relPath.slice(ASSETS_DIR.length + 1))
        ? ` Drop the "${ASSETS_DIR}/" prefix: staticFile('${relPath.slice(ASSETS_DIR.length + 1)}').`
        : '';
      errors.push(`staticFile('${ref}'): assets/${relPath} does not exist.${hint} ${listForError(files)}.`);
      continue;
    }
    if (!file.kind) {
      errors.push(`staticFile('${ref}'): ${path.extname(relPath) || 'a file without an extension'} is not a kind the renderer serves. It serves ${SERVED_KINDS}.`);
      continue;
    }
    const key = shotAssetKey(relPath);
    const clash = keys.get(key);
    if (clash && clash !== relPath) {
      errors.push(`staticFile('${ref}') and staticFile('${clash}') look up the same key "${key}" (the name without its extension): rename one file.`);
      continue;
    }
    keys.set(key, relPath);
    if (!assets.some((a) => a.relPath === relPath)) {
      const lint = await lintAssetFile(assetsDir, relPath);
      if (lint) {
        errors.push(lint);
        continue;
      }
      assets.push({ ref, key, relPath, kind: file.kind, bytes: file.bytes });
    }
  }
  return { assets, errors };
}

/** Lookup key → POSIX path inside the assets folder: what a version needs to be played. */
export type AssetKeyMap = Record<string, string>;

export function assetKeyMap(assets: Array<Pick<BuildAsset, 'key' | 'relPath'>>): AssetKeyMap {
  return Object.fromEntries(assets.map((a) => [a.key, a.relPath]));
}

/** The `assets` prop for a page loaded from `origin`: each key → its asset-root URL there. */
export function assetsProp(origin: string, assetsDir: string, keys: AssetKeyMap): Record<string, string> {
  return Object.fromEntries(Object.entries(keys).map(([key, rel]) => [key, assetRootUrl(origin, assetsDir, rel)]));
}

/**
 * Every literal staticFile() name in a single-file artifact (a saved `vN.tsx`
 * keeps them as `__vidtsxAsset('…')` after the bundle step), as key → path
 * inside assets/. What a consumer needs to play a saved version.
 */
export function assetRefsInArtifact(code: string): AssetKeyMap {
  const out: AssetKeyMap = {};
  for (const match of code.matchAll(/\b(?:__vidtsxAsset|staticFile\d*)\(\s*(["'`])([^"'`$\\]+)\1\s*\)/g)) {
    const rel = match[2].replace(/\\/g, '/').replace(/^\.?\/+/, '');
    out[shotAssetKey(rel)] = rel;
  }
  return out;
}
