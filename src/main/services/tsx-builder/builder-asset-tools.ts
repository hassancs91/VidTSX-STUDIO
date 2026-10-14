// Where a builder's files come from (TSX_BUILDER_DESIGN.md P2 part 4; Hasan's
// pick 10-13: its own files, the user's asset library, and generated images).
//
// - The request's files are copied into work/assets/ before the session starts
//   (`attachRequestAssets`); an edit also gets the version's `vN.assets/`.
// - `library_search` / `library_use` (free): find a file in the app-wide asset
//   library (by name, folder and description) and copy it into assets/.
// - `generate_image` (PAID): the configured image provider makes a PNG; it is
//   filed into the library (generated/, like Studio's generate_image) and copied
//   into assets/. Capped per run; every image's estimated cost is reported.
//
// The builder writes its own small files (SVG, JSON, CSV) with Write, and can
// Read an image in assets/ to see it.

import fs from 'fs/promises';
import path from 'path';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { imageEngine } from '../../../image-engine';
import { generateImageAsset } from '../library/generate-image-asset';
import { getLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { scanLibrary } from '../library/library-store';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { ASSETS_DIR, assetKindOf, formatBytes, type AssetKind } from './build-assets';
import { logEvent, text, tracked, type BuilderState } from './builder-tool-common';

export const LIBRARY_REF_PREFIX = 'library:';

/** generate_image calls per run, by budget, unless the request sets its own. */
export const GENERATED_IMAGES_MAX = { quick: 2, standard: 4, craft: 6 } as const;

/** A name inside assets/: relative, POSIX, no `..`, a served extension. Null when unusable. */
export function cleanAssetName(name: string): string | null {
  const clean = name.trim().replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(new RegExp(`^${ASSETS_DIR}/`), '');
  if (!clean || /^[a-zA-Z]:/.test(name) || clean.split('/').some((s) => s === '..' || s === '' || s.startsWith('.'))) return null;
  return assetKindOf(clean) ? clean : null;
}

async function exists(p: string): Promise<boolean> {
  return fs.stat(p).then(
    () => true,
    () => false,
  );
}

/** Copy one file into assets/ as `name`; refuses to overwrite a different file. */
async function placeAsset(assetsDir: string, from: string, name: string): Promise<{ relPath: string; bytes: number }> {
  const to = path.join(assetsDir, ...name.split('/'));
  if (await exists(to)) throw new Error(`assets/${name} already exists: pick another name.`);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
  return { relPath: name, bytes: (await fs.stat(to)).size };
}

/** The files a .gltf names beside it (buffers, images), relative to it. */
async function gltfSiblings(file: string): Promise<string[]> {
  try {
    const json = JSON.parse(await fs.readFile(file, 'utf-8')) as { buffers?: Array<{ uri?: string }>; images?: Array<{ uri?: string }> };
    return [...(json.buffers ?? []), ...(json.images ?? [])]
      .map((b) => b.uri)
      .filter((u): u is string => typeof u === 'string' && !u.startsWith('data:') && !/^[a-z]+:/i.test(u))
      .map((u) => decodeURIComponent(u));
  } catch {
    return [];
  }
}

/**
 * Copy `from` into assets/ as `name`, with a .gltf's buffers and textures
 * beside it (under the same relative paths). Returns what was placed.
 */
export async function copyIntoAssets(assetsDir: string, from: string, name: string): Promise<Array<{ relPath: string; bytes: number }>> {
  const placed = [await placeAsset(assetsDir, from, name)];
  if (path.extname(name).toLowerCase() === '.gltf') {
    const dir = path.posix.dirname(name);
    for (const sibling of await gltfSiblings(from)) {
      const target = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, sibling));
      if (target.startsWith('..')) continue;
      const source = path.join(path.dirname(from), ...sibling.split('/'));
      if (await exists(source)) placed.push(await placeAsset(assetsDir, source, target));
    }
  }
  return placed;
}

export interface RequestAsset {
  /** An absolute path, or `library:<path in the asset library>`. */
  path: string;
  /** The name inside assets/ (default: the file name). */
  name?: string;
}

/** Copy the request's files into `assetsDir`. Throws a message meant for the caller. */
export async function attachRequestAssets(assetsDir: string, list: RequestAsset[]): Promise<void> {
  for (const item of list) {
    const from = item.path.startsWith(LIBRARY_REF_PREFIX)
      ? resolveLibraryPath(getLibraryRoot(), item.path.slice(LIBRARY_REF_PREFIX.length).trim())
      : item.path;
    if (!path.isAbsolute(from)) throw new Error(`Asset "${item.path}": give an absolute path or a library: ref.`);
    const stat = await fs.stat(from).catch(() => null);
    if (!stat?.isFile()) throw new Error(`Asset "${item.path}" was not found.`);
    const name = cleanAssetName(item.name ?? path.basename(from));
    if (!name) throw new Error(`Asset "${item.path}": "${item.name ?? path.basename(from)}" is not a usable name inside assets/ (or not a file kind the renderer serves).`);
    await copyIntoAssets(assetsDir, from, name);
  }
}

// ─── library search ───

export interface LibraryHit {
  relPath: string;
  kind: AssetKind;
  bytes: number;
  description?: string;
  width?: number;
  height?: number;
  score: number;
}

const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9À-￿]+/).filter((w) => w.length > 1);

/** Rank library entries for `query`: every word counts, a match in the file name more than one in the description. Pure. */
export function rankLibrary(entries: Array<Pick<LibraryIndexEntry, 'relPath' | 'description' | 'size' | 'probe'>>, query: string, kind?: AssetKind, limit = 20): LibraryHit[] {
  const q = words(query);
  const hits: LibraryHit[] = [];
  for (const e of entries) {
    const k = assetKindOf(e.relPath);
    if (!k || (kind && k !== kind)) continue;
    const name = words(e.relPath);
    const desc = words(e.description ?? '');
    let score = 0;
    for (const w of q) {
      if (name.some((n) => n === w)) score += 3;
      else if (name.some((n) => n.includes(w))) score += 2;
      if (desc.some((d) => d === w || d.startsWith(w))) score += 1;
    }
    if (q.length > 0 && score === 0) continue;
    hits.push({
      relPath: e.relPath,
      kind: k,
      bytes: e.size ?? 0,
      ...(e.description ? { description: e.description } : {}),
      ...(e.probe?.width ? { width: e.probe.width, height: e.probe.height } : {}),
      score,
    });
  }
  return hits.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath)).slice(0, limit);
}

/**
 * Can the active image provider make an image now (what generate_image needs)?
 * Registered is not enough (P2 problem 3): the local sd-cli is registered
 * whether or not it is installed, so B4, B5 and B7 were offered it and failed.
 */
export async function imageGenerationAvailable(): Promise<{ ok: true; provider: string } | { ok: false; reason: string }> {
  try {
    const ready = await imageEngine.checkReady();
    return ready.ready ? { ok: true, provider: ready.providerId } : { ok: false, reason: ready.reason };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

const KINDS = ['image', 'video', 'audio', 'model', 'environment', 'font', 'data'] as const;

export function buildAssetTools(state: BuilderState) {
  const assetsDir = () => path.join(state.dirs.workDir, ASSETS_DIR);
  let index: Promise<LibraryIndexEntry[]> | null = null;
  const libraryEntries = () => {
    index ??= scanLibrary(getLibraryRoot()).catch((err: unknown) => {
      index = null;
      throw err;
    });
    return index;
  };

  const librarySearch = tool(
    'library_search',
    "Search the user's asset library (their own files: photos, logos, models, HDRIs, fonts, sounds) by words in the file name, folder and description. Returns paths to pass to library_use. Free.",
    {
      query: z.string().describe('Words to match, e.g. "logo dark" or "robot". Empty lists everything (up to the limit).'),
      kind: z.enum(KINDS).optional().describe('Only this kind of file'),
      limit: z.number().int().min(1).max(50).optional().describe('Rows to return (default 20)'),
    },
    tracked(state, 'working', async (args: { query: string; kind?: AssetKind; limit?: number }) => {
      try {
        const hits = rankLibrary(await libraryEntries(), args.query, args.kind, args.limit ?? 20);
        await logEvent(state, { tool: 'library_search', query: args.query, kind: args.kind, hits: hits.length });
        if (hits.length === 0) return text(`Nothing in the library matches "${args.query}"${args.kind ? ` (${args.kind})` : ''}.`);
        const rows = hits.map(
          (h) => `- ${h.relPath} (${h.kind}, ${formatBytes(h.bytes)}${h.width ? `, ${h.width}x${h.height}` : ''})${h.description ? `: ${h.description.slice(0, 160)}` : ''}`,
        );
        return text(`${hits.length} match${hits.length === 1 ? '' : 'es'}:\n${rows.join('\n')}\nCopy one into assets/ with library_use.`);
      } catch (err) {
        return text(`The library could not be read: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    }),
  );

  const libraryUse = tool(
    'library_use',
    "Copy a file from the user's asset library into your assets/ folder (a .gltf brings its .bin and textures). Then load it with staticFile('<name>'). Free.",
    {
      path: z.string().describe('The library path library_search returned'),
      name: z.string().optional().describe('Its name inside assets/ (default: the file name)'),
    },
    tracked(state, 'working', async (args: { path: string; name?: string }) => {
      const rel = args.path.replace(new RegExp(`^${LIBRARY_REF_PREFIX}`), '').trim();
      let from: string;
      try {
        from = resolveLibraryPath(getLibraryRoot(), rel);
      } catch (err) {
        return text(`"${args.path}" is not a library path: ${err instanceof Error ? err.message : String(err)}`, true);
      }
      const name = cleanAssetName(args.name ?? path.basename(rel));
      if (!name) return text(`"${args.name ?? path.basename(rel)}" is not a usable name inside assets/, or not a file kind the renderer serves.`, true);
      if (!(await exists(from))) return text(`"${rel}" is not in the library (search again).`, true);
      try {
        const placed = await copyIntoAssets(assetsDir(), from, name);
        await logEvent(state, { tool: 'library_use', from: rel, placed: placed.map((p) => p.relPath) });
        state.onEvent?.({ type: 'asset', source: 'library', files: placed.map((p) => p.relPath) });
        return text(
          `Copied into assets/: ${placed.map((p) => `${p.relPath} (${formatBytes(p.bytes)})`).join(', ')}. Load it with staticFile('${placed[0].relPath}').`,
        );
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }
    }),
  );

  const generateImage = tool(
    'generate_image',
    `PAID: make an image with the user's image provider and put it in assets/ as a PNG (it is also filed in their library). For a photo, texture, backdrop, character or object that code cannot draw well; never for text, charts, icons or diagrams (draw those). At most ${state.imagesMax} per run. Look at it before you use it (Read it, or render_stills).`,
    {
      prompt: z.string().min(1).describe('What the image shows: subject, style, light, composition, background; concrete and visual'),
      name: z.string().describe("Its name inside assets/, ending in .png, e.g. 'backdrop.png'"),
      aspect: z.enum(['square', 'landscape', 'portrait']).optional().describe('Default square (1024x1024); landscape 1280x720; portrait 720x1280'),
    },
    tracked(state, 'working', async (args: { prompt: string; name: string; aspect?: 'square' | 'landscape' | 'portrait' }) => {
      if (state.imagesGenerated >= state.imagesMax) {
        return text(`generate_image is used up (${state.imagesMax}/${state.imagesMax} this run). Use what you have, or draw it.`, true);
      }
      const available = await imageGenerationAvailable();
      if (!available.ok) return text(`generate_image cannot run (${available.reason}): draw it, or use the library.`, true);
      const name = cleanAssetName(args.name.toLowerCase().endsWith('.png') ? args.name : `${args.name}.png`);
      if (!name) return text(`"${args.name}" is not a usable name inside assets/.`, true);
      if (await exists(path.join(assetsDir(), ...name.split('/')))) return text(`assets/${name} already exists: pick another name.`, true);
      state.imagesGenerated += 1;
      const started = Date.now();
      try {
        const asset = await generateImageAsset({
          prompt: args.prompt,
          aspect: args.aspect ?? 'square',
          featureSource: 'tsx-generation',
          ...(state.signal ? { signal: state.signal } : {}),
        });
        const placed = await copyIntoAssets(assetsDir(), resolveLibraryPath(getLibraryRoot(), asset.relPath), name);
        state.imageCostUsd += asset.costUsd;
        await logEvent(state, {
          tool: 'generate_image',
          n: state.imagesGenerated,
          name,
          library: asset.relPath,
          provider: asset.provider,
          model: asset.model,
          costUsd: asset.costUsd,
          ms: Date.now() - started,
        });
        state.onEvent?.({ type: 'asset', source: 'generated', files: placed.map((p) => p.relPath), costUsd: asset.costUsd });
        return text(
          `Made assets/${name} (${asset.width}x${asset.height}, ${formatBytes(placed[0].bytes)}) with ${asset.provider} ${asset.model}${asset.costUsd > 0 ? `, ~$${asset.costUsd.toFixed(3)}` : ''}. Generated ${state.imagesGenerated}/${state.imagesMax} this run. Look at it before you build on it.`,
        );
      } catch (err) {
        state.imagesGenerated -= 1;
        await logEvent(state, { tool: 'generate_image', error: err instanceof Error ? err.message : String(err) });
        return text(`Image generation failed: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    }),
  );

  return [librarySearch, libraryUse, generateImage];
}
