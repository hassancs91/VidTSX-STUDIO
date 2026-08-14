// D12 import-on-use seam. Shot asset refs arrive as key → (project asset id
// OR 'library:<relPath>'). Library values cross into the project HERE — the
// file is imported as a normal StudioMediaAsset (referenced in place at its
// library path, index description carried along) and the ref is rewritten to
// the project asset id. The library never appears in project.json; the
// registry only ever stores project asset ids.
//
// Main never writes project.json (renderer owns the document), so imported
// assets travel back on the shot job event for the renderer to adopt.

import path from 'path';
import fs from 'fs/promises';
import type { StudioMediaAsset, StudioProject } from '../../../shared/types/studio';
import type { ShotPromptAsset } from '../../../shared/studio/shot-prompt';
import { getLibraryRoot, resolveLibraryPath, toLibraryRelPath } from '../library/library-paths';
import { loadIndex } from '../library/library-store';
import { importMediaFiles, hashFileHead } from './media-import';

export const LIBRARY_REF_PREFIX = 'library:';

/** Keys become `assets.<key>` member accesses in generated code. */
const REF_KEY_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function isValidRefKey(key: string): boolean {
  return REF_KEY_PATTERN.test(key);
}

/** The library-relative path inside a 'library:…' ref value, or null. */
export function parseLibraryRef(value: string): string | null {
  if (!value.startsWith(LIBRARY_REF_PREFIX)) return null;
  const relPath = value.slice(LIBRARY_REF_PREFIX.length).trim().replace(/\\/g, '/');
  return relPath.length > 0 ? relPath : null;
}

/** Same file already in the project? Path identity first (case-insensitive on
 *  Windows), content-hash identity second — re-using the id keeps import-on-use
 *  idempotent across repeated refs to the same library file. */
export function matchExistingAsset(
  assets: readonly StudioMediaAsset[],
  absPath: string,
  hash: string | undefined,
): StudioMediaAsset | undefined {
  const normalize = (p: string): string => {
    const resolved = path.resolve(p);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  const wanted = normalize(absPath);
  return (
    assets.find((a) => normalize(a.path) === wanted) ??
    (hash ? assets.find((a) => a.hash !== undefined && a.hash === hash) : undefined)
  );
}

/** The prompt table (D8 Rev 2): what the model may know about each ref. */
export function buildPromptAssets(
  refs: Record<string, string>,
  assetsById: ReadonlyMap<string, StudioMediaAsset>,
): ShotPromptAsset[] {
  return Object.entries(refs).map(([key, assetId]) => {
    const asset = assetsById.get(assetId);
    if (!asset) throw new Error(`Asset ref '${key}' points at unknown asset '${assetId}'`);
    if (asset.kind !== 'image' && asset.kind !== 'video') {
      throw new Error(
        `Asset ref '${key}' is ${asset.kind} — shots are visual-only (D2); audio belongs on the timeline, not inside a shot.`,
      );
    }
    return {
      key,
      kind: asset.kind,
      ...(asset.probe.width !== undefined ? { width: asset.probe.width } : {}),
      ...(asset.probe.height !== undefined ? { height: asset.probe.height } : {}),
      ...(asset.kind === 'video' ? { durationSeconds: asset.probe.duration } : {}),
      ...(asset.description ? { description: asset.description } : {}),
    };
  });
}

export interface ResolvedShotAssetRefs {
  /** Final registry-shaped refs: key → project asset id. */
  refs: Record<string, string>;
  /** Library files imported by this resolution — NOT yet in project.json;
   *  the renderer adopts them off the shot job event. */
  imported: StudioMediaAsset[];
  /** Table for buildShotExtraInstructions. */
  promptAssets: ShotPromptAsset[];
}

/**
 * Resolve raw request refs against the project, importing library values on
 * use. Throws pointed errors (unknown id, missing library file, audio ref,
 * bad key) — callers surface them as tool/IPC errors, never partial shots.
 */
export async function resolveShotAssetRefs(
  project: StudioProject,
  rawRefs: Record<string, string>,
): Promise<ResolvedShotAssetRefs> {
  const refs: Record<string, string> = {};
  const imported: StudioMediaAsset[] = [];
  const known = new Map(project.assets.map((a) => [a.id, a] as const));
  // Lazy: only touched when a library ref shows up.
  let libraryRoot: string | null = null;
  let descriptions: Map<string, string> | null = null;

  for (const [key, value] of Object.entries(rawRefs)) {
    if (!isValidRefKey(key)) {
      throw new Error(
        `Asset ref key '${key}' is not a valid identifier — use letters/digits/underscore, starting with a letter (it becomes assets.${key} in code).`,
      );
    }
    const relPath = parseLibraryRef(value);
    if (relPath === null) {
      if (!known.has(value)) {
        throw new Error(
          `Asset ref '${key}': '${value}' is neither a project asset id nor a 'library:<path>' ref.`,
        );
      }
      refs[key] = value;
      continue;
    }

    libraryRoot ??= getLibraryRoot();
    const absPath = resolveLibraryPath(libraryRoot, relPath);
    try {
      await fs.access(absPath);
    } catch {
      throw new Error(`Library asset not found: ${relPath}`);
    }

    const hash = await hashFileHead(absPath);
    const existing = matchExistingAsset([...known.values()], absPath, hash);
    if (existing) {
      refs[key] = existing.id;
      continue;
    }

    const { assets, errors } = await importMediaFiles(project.id, [absPath]);
    if (assets.length === 0) {
      throw new Error(`Could not import library asset ${relPath}: ${errors.join(' ') || 'unknown error'}`);
    }
    if (descriptions === null) {
      const index = await loadIndex(libraryRoot);
      descriptions = new Map(
        index.entries
          .filter((e) => e.description)
          .map((e) => [e.relPath, e.description as string] as const),
      );
    }
    const description = descriptions.get(toLibraryRelPath(libraryRoot, absPath));
    const asset: StudioMediaAsset = {
      ...assets[0],
      ...(description ? { description } : {}),
    };
    imported.push(asset);
    known.set(asset.id, asset);
    refs[key] = asset.id;
  }

  return { refs, imported, promptAssets: buildPromptAssets(refs, known) };
}
