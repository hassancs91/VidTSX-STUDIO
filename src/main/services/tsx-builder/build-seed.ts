// Where an edit starts (TSX_BUILDER_DESIGN.md T3; P3 part 3): the work folder
// an edit's builder gets, filled from a saved version.
//
// A saved `vN.tsx` is the builder's BUNDLE (its files inlined, staticFile()
// rewritten for the `assets` prop); `vN.src/` is what it wrote. The Creator
// can change `vN.tsx` by hand afterwards — Overwrite, the Code tab's
// auto-save, "Save as new version" — and then `vN.src/` no longer says what
// `vN.tsx` is. So there are three ways to start:
//
//   src         vN.src/ as the builder saved it, and vN.tsx still is its
//               bundle (vN.debug.json's `artifactSha256`; a version saved
//               before the hash is taken as unchanged).
//   hand-edits  the newest vK.src/ (K ≤ N) plus HAND-EDITS.diff: the hand
//               changes as a diff of vK's bundle against vN.tsx, for the model
//               to carry into its files. A bundle overwritten in place is
//               remade from vK.src/ (`rebundle`) to diff against.
//   file        vN.tsx as index.tsx: a version made before the builder (the
//               pipeline, a hand-made project), or a bundle rewritten by hand
//               past what a diff can carry (then vK's DESIGN.md comes along).

import fs from 'fs/promises';
import path from 'path';
import { parseCompositionConfig, type CompositionConfig } from '../composition-config-parser';
import { ASSETS_DIR, BUILD_ENTRY, HAND_EDITS_FILE } from './constants';
import { formatFromConfig } from './build-format';
import { listVersionNumbers, sha256Text } from './build-store';
import { versionAssetFiles } from './version-assets';
import { assetRefsInArtifact } from './build-assets';
import { unifiedLineDiff } from './line-diff';
import type { BuildFormat } from './types';

export { HAND_EDITS_FILE };
/** Past this many changed lines a hand change is a rewrite: the edit starts from the file. */
export const HAND_EDITS_MAX_LINES = 400;

export type SeedKind = 'src' | 'hand-edits' | 'file';

export interface SeededBuild {
  version: number;
  folderPath: string;
  kind: SeedKind;
  /** The builder version whose files the folder holds: N for `src` (or the K it equals), K for `hand-edits` and a rewritten bundle. */
  srcVersion?: number;
  /** `hand-edits`: lines removed plus added in HAND-EDITS.diff. */
  handEditLines?: number;
  /** `file`: index.tsx is a builder bundle rewritten by hand, not a pre-builder file. */
  bundle?: boolean;
  /** `file` from a bundle: it names files, as __vidtsxAsset('…'), that assets/ now holds. */
  bundleAssets?: boolean;
  config: CompositionConfig | null;
  /** The format the version was built to, when it can be told. */
  format: BuildFormat | null;
  /** The craft packs and style words the version was built with (P4): an edit that names none keeps these. */
  craft?: VersionCraft;
}

export interface VersionCraft {
  packs: string[];
  style?: string;
}

export interface SeedDeps {
  /** vK.src/ bundled again, as `check` bundles (null when it does not bundle). */
  rebundle?: (srcDir: string) => Promise<string | null>;
}

async function isDirectory(p: string): Promise<boolean> {
  const stat = await fs.stat(p).catch(() => null);
  return stat?.isDirectory() === true;
}

interface BuilderRecord {
  format: BuildFormat | null;
  artifactSha256: string | null;
  craft: VersionCraft | null;
}

const NO_RECORD: BuilderRecord = { format: null, artifactSha256: null, craft: null };

function craftOf(request: { craftPacks?: unknown; style?: unknown } | undefined): VersionCraft | null {
  const packs = Array.isArray(request?.craftPacks) ? request.craftPacks.filter((id): id is string => typeof id === 'string') : [];
  const style = typeof request?.style === 'string' && request.style.trim() ? request.style.trim() : undefined;
  return packs.length || style ? { packs, ...(style ? { style } : {}) } : null;
}

async function readBuilderRecord(folderPath: string, version: number): Promise<BuilderRecord> {
  try {
    const debug = JSON.parse(await fs.readFile(path.join(folderPath, `v${version}.debug.json`), 'utf-8')) as {
      kind?: string;
      request?: { format?: BuildFormat; craftPacks?: unknown; style?: unknown };
      artifactSha256?: string;
    };
    if (debug.kind !== 'tsx-builder') return NO_RECORD;
    return { format: debug.request?.format ?? null, artifactSha256: debug.artifactSha256 ?? null, craft: craftOf(debug.request) };
  } catch {
    return NO_RECORD;
  }
}

/** The version an edit continues: the one asked for, else the latest. Throws when there is none. */
export async function resolveEditVersion(
  editOf: { folderPath: string; version?: number },
): Promise<{ version: number; tsxPath: string }> {
  const versions = await listVersionNumbers(editOf.folderPath);
  const version = editOf.version ?? versions[versions.length - 1];
  if (version === undefined || !versions.includes(version)) {
    throw new Error(
      editOf.version !== undefined
        ? `v${editOf.version}.tsx not found in ${editOf.folderPath}`
        : `No version to edit in ${editOf.folderPath}`,
    );
  }
  return { version, tsxPath: path.join(editOf.folderPath, `v${version}.tsx`) };
}

/** The newest K ≤ `version` that kept the builder's files (vK.src/), or null. */
async function builderSource(folderPath: string, version: number): Promise<number | null> {
  const candidates = (await listVersionNumbers(folderPath)).filter((n) => n <= version).reverse();
  for (const k of candidates) {
    if (await isDirectory(path.join(folderPath, `v${k}.src`))) return k;
  }
  return null;
}

/** vK.tsx as the builder saved it: the file when it still matches its hash, else remade from vK.src/. */
async function savedBundle(folderPath: string, k: number, record: BuilderRecord, deps: SeedDeps): Promise<{ text: string; intact: boolean } | null> {
  const text = await fs.readFile(path.join(folderPath, `v${k}.tsx`), 'utf-8');
  if (!record.artifactSha256 || sha256Text(text) === record.artifactSha256) return { text, intact: true };
  const remade = deps.rebundle ? await deps.rebundle(path.join(folderPath, `v${k}.src`)).catch(() => null) : null;
  return remade ? { text: remade, intact: false } : null;
}

async function copySource(folderPath: string, k: number, workDir: string): Promise<void> {
  await fs.cp(path.join(folderPath, `v${k}.src`), workDir, { recursive: true });
  // Copies, never links: the builder may rewrite a file in its folder, and a
  // saved version must not change under it.
  const assetsDir = path.join(folderPath, `v${k}.assets`);
  if (await isDirectory(assetsDir)) await fs.cp(assetsDir, path.join(workDir, ASSETS_DIR), { recursive: true });
}

/** A one-file seed: the version's own `.assets/`, and every other file its code names that an earlier version holds. */
async function copyFileSeed(tsxPath: string, code: string, workDir: string): Promise<void> {
  await fs.writeFile(path.join(workDir, BUILD_ENTRY), code, 'utf-8');
  const ownAssets = tsxPath.replace(/\.tsx$/, '.assets');
  if (await isDirectory(ownAssets)) await fs.cp(ownAssets, path.join(workDir, ASSETS_DIR), { recursive: true });
  for (const file of await versionAssetFiles(tsxPath, code)) {
    if (!file.path) continue;
    const to = path.join(workDir, ASSETS_DIR, ...file.relPath.split('/'));
    if (await fs.stat(to).then(() => true, () => false)) continue;
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(file.path, to);
  }
}

/** Fill `workDir` from a saved version so an edit continues where it stopped (the header says how). */
export async function seedWorkFromVersion(
  editOf: { folderPath: string; version?: number },
  workDir: string,
  deps: SeedDeps = {},
): Promise<SeededBuild> {
  const { version, tsxPath } = await resolveEditVersion(editOf);
  const folderPath = editOf.folderPath;
  const code = await fs.readFile(tsxPath, 'utf-8');
  const config = parseCompositionConfig(code);
  const own = await readBuilderRecord(folderPath, version);
  const k = await builderSource(folderPath, version);
  if (k === null) {
    await copyFileSeed(tsxPath, code, workDir);
    const craft = own.craft;
    return { version, folderPath, config, ...(craft ? { craft } : {}), kind: 'file', format: own.format ?? (config ? formatFromConfig(config) : null) };
  }

  const record = k === version ? own : await readBuilderRecord(folderPath, k);
  // A version saved by hand has no builder record of its own: it keeps vK's packs.
  const craft = own.craft ?? record.craft;
  const base = { version, folderPath, config, ...(craft ? { craft } : {}) };
  const saved = await savedBundle(folderPath, k, record, deps);
  if (k === version && saved?.intact) {
    await copySource(folderPath, k, workDir);
    return { ...base, kind: 'src', srcVersion: k, format: own.format ?? (config ? formatFromConfig(config) : null) };
  }

  // vN.tsx was changed by hand after the builder saved vK: its own config is the format now.
  const format = config ? formatFromConfig(config, record.format?.loop) : record.format;
  const diff = saved
    ? unifiedLineDiff(saved.text, code, {
        aName: `v${k}.tsx (as the builder saved it)`,
        bName: `v${version}.tsx (as it is now)`,
        maxChanged: HAND_EDITS_MAX_LINES,
      })
    : null;
  if (diff && diff.changed === 0) {
    await copySource(folderPath, k, workDir);
    return { ...base, kind: 'src', srcVersion: k, format: record.format ?? format };
  }
  if (diff) {
    await copySource(folderPath, k, workDir);
    await fs.writeFile(path.join(workDir, HAND_EDITS_FILE), diff.text, 'utf-8');
    return { ...base, kind: 'hand-edits', srcVersion: k, handEditLines: diff.changed, format };
  }

  // A rewrite (or a bundle that cannot be remade): the file itself, with vK's design notes.
  await copyFileSeed(tsxPath, code, workDir);
  const design = path.join(folderPath, `v${k}.src`, 'DESIGN.md');
  await fs.copyFile(design, path.join(workDir, 'DESIGN.md')).catch(() => {});
  const bundleAssets = Object.keys(assetRefsInArtifact(code)).length > 0;
  return { ...base, kind: 'file', bundle: true, srcVersion: k, ...(bundleAssets ? { bundleAssets } : {}), format };
}
