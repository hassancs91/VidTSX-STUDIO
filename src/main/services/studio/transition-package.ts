// Reading a `.vidtsxpack` / `.vidtsxtransition` (docs/studio/
// TRANSITION_PACKS_DESIGN.md "Import — two extensions"). Three layers, like
// the agent package:
//   1. `zip-reader.ts` — the container is sane (caps, manifest-as-allowlist,
//      declared == actual, every byte hashed);
//   2. `shared/studio/transition-package.ts` — the manifest is acceptable to
//      THIS build (format, minAppVersion, ids, reserved `imported`);
//   3. here — the per-item TSX gate, and the plan against what is installed.
// Nothing is written: inspect is cheap, and install (transition-install.ts)
// re-opens the file rather than trusting an earlier read.

import fs from 'fs/promises';
import path from 'path';
import * as esbuild from 'esbuild';
import { openZipPackage, PackageReadError, type OpenedZipPackage, type ZipReaderSpec } from '../packages/zip-reader';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { namespacedId } from '../../../shared/studio/caption-pack';
import { IMPORTED_PACK_ID, type TransitionEntry } from '../../../shared/studio/transition-pack';
import {
  TRANSITION_PACKAGE_LIMITS,
  TRANSITION_PACK_MANIFEST,
  TRANSITION_SINGLE_MANIFEST,
  TransitionPackageError,
  packComponentPath,
  parsePackPackageManifest,
  parseSingleTransitionManifest,
  singleComponentPath,
  transitionPackageFormat,
  versionAction,
  type PackageFileDeclaration,
  type SingleTransitionPackage,
  type TransitionPackPackage,
  type VersionAction,
} from '../../../shared/studio/transition-package';
import type { InspectedTransitionItem, InspectedTransitionPackage } from '../../../shared/ipc/types/studio-transitions';

export { PackageReadError };

/** Null = the source may run; a string = why it may not. */
export type TransitionGate = (source: string) => Promise<string | null>;

export interface TransitionPackageDeps {
  appVersion: string;
  builtinRoot: string;
  installedRoot: string;
  /** Overridable for tests; the default is `defaultTransitionGate`. */
  gate?: TransitionGate;
}

/**
 * The gate a component clears before it is installed — the same import rules
 * the module handler applies at resolve (react/remotion only, one file, no
 * compositionConfig), plus a compile, so a file that will never load is
 * refused at the door rather than discovered in the preview.
 */
export const defaultTransitionGate: TransitionGate = async (source) => {
  const lint = lintShotSource(source, { requireCompositionConfig: false });
  if (!lint.ok) return lint.errors.join(' ');
  try {
    await esbuild.transform(source, { loader: 'tsx', jsx: 'automatic', format: 'esm' });
    return null;
  } catch (err) {
    const first = (err as { errors?: Array<{ text: string }> }).errors?.[0]?.text;
    return `It does not compile: ${first ?? 'unknown error'}`;
  }
};

type Parsed = TransitionPackPackage | SingleTransitionPackage;

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function spec(format: 'pack' | 'single', appVersion: string): ZipReaderSpec<Parsed> {
  return {
    manifestName: format === 'pack' ? TRANSITION_PACK_MANIFEST : TRANSITION_SINGLE_MANIFEST,
    parseManifest(raw) {
      try {
        return format === 'pack' ? parsePackPackageManifest(raw, appVersion) : parseSingleTransitionManifest(raw, appVersion);
      } catch (err) {
        if (err instanceof TransitionPackageError) throw new PackageReadError(err.message);
        throw err;
      }
    },
    filesOf: (manifest): readonly PackageFileDeclaration[] => manifest.files,
    limits: {
      maxEntries: TRANSITION_PACKAGE_LIMITS.maxEntries,
      maxManifestBytes: TRANSITION_PACKAGE_LIMITS.maxManifestBytes,
      maxReadBytes: TRANSITION_PACKAGE_LIMITS.maxComponentBytes,
      maxEntryBytes: TRANSITION_PACKAGE_LIMITS.maxEntryBytes,
      maxTotalBytes: TRANSITION_PACKAGE_LIMITS.maxTotalBytes,
    },
    notReadableMessage:
      format === 'pack' ? 'This file is not a readable .vidtsxpack.' : 'This file is not a readable .vidtsxtransition.',
  };
}

/** One component after the gate: its source when it passed, else why not. */
export interface GatedItem {
  entry: TransitionEntry;
  componentPath: string;
  source?: string;
  refused?: string;
}

export interface OpenedTransitionPackage {
  parsed: Parsed;
  zip: OpenedZipPackage<Parsed>;
  /** Target pack folder: the pack's own id, or `imported` for a single. */
  packId: string;
  items: GatedItem[];
}

/**
 * Open, validate and gate a package. A container or manifest problem throws
 * (`PackageReadError`, message = dialog text). A component that fails the
 * gate is marked refused — one bad item never sinks a pack — but a single
 * whose only component fails is refused outright.
 */
export async function openTransitionPackage(
  filePath: string,
  deps: TransitionPackageDeps,
): Promise<OpenedTransitionPackage> {
  const format = transitionPackageFormat(filePath);
  if (!format) throw new PackageReadError('Not a transition package (.vidtsxpack or .vidtsxtransition).');
  const zip = await openZipPackage(filePath, spec(format, deps.appVersion));
  const parsed = zip.manifest;
  // Built-ins scan first, so a pack sharing a built-in id would never load.
  if (parsed.format === 'pack' && (await exists(path.join(deps.builtinRoot, parsed.manifest.id)))) {
    throw new PackageReadError(`"${parsed.manifest.id}" is a built-in pack id, so this pack could never load.`);
  }
  const gate = deps.gate ?? defaultTransitionGate;

  const entries = parsed.format === 'pack' ? parsed.entries : [parsed.entry];
  const items: GatedItem[] = [];
  for (const entry of entries) {
    const componentPath = parsed.format === 'pack' ? packComponentPath(entry.id) : singleComponentPath(entry.id);
    const source = (await zip.read(componentPath)).toString('utf-8');
    const refused = await gate(source);
    items.push(refused ? { entry, componentPath, refused } : { entry, componentPath, source });
  }
  if (parsed.format === 'single' && items[0].refused) {
    throw new PackageReadError(`"${parsed.entry.name}" cannot be installed: ${items[0].refused}`);
  }
  if (items.every((item) => item.refused)) {
    throw new PackageReadError(`None of this pack's transitions can be installed:\n${items.map((i) => `• ${i.entry.name}: ${i.refused}`).join('\n')}`);
  }
  return { parsed, zip, packId: parsed.format === 'pack' ? parsed.manifest.id : IMPORTED_PACK_ID, items };
}

/** An installed pack's pack.json, or null when there is none (or it is unreadable). */
export async function readInstalledPack(
  installedRoot: string,
  packId: string,
): Promise<{ version: string; transitions: Array<Record<string, unknown>>; raw: Record<string, unknown> } | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(installedRoot, packId, TRANSITION_PACK_MANIFEST), 'utf-8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const doc = raw as Record<string, unknown>;
    return {
      version: typeof doc.version === 'string' ? doc.version : '0.0.0',
      transitions: Array.isArray(doc.transitions) ? (doc.transitions as Array<Record<string, unknown>>) : [],
      raw: doc,
    };
  } catch {
    return null;
  }
}

/** What an install would do: per pack for a `.vidtsxpack`, per item for a single. */
export async function planTransitionPackage(
  opened: OpenedTransitionPackage,
  installedRoot: string,
): Promise<{ action: VersionAction; installedVersion: string | null }> {
  const installed = await readInstalledPack(installedRoot, opened.packId);
  if (opened.parsed.format === 'pack') {
    const installedVersion = installed?.version ?? null;
    return { action: versionAction(opened.parsed.manifest.version, installedVersion), installedVersion };
  }
  const id = opened.parsed.entry.id;
  const existing = installed?.transitions.find((t) => t.id === id);
  const installedVersion = existing ? (typeof existing.version === 'string' ? existing.version : '0.0.0') : null;
  return { action: versionAction(opened.parsed.entry.version, installedVersion), installedVersion };
}

/** The dialog's view of a package. */
export async function inspectTransitionPackage(
  filePath: string,
  deps: TransitionPackageDeps,
): Promise<InspectedTransitionPackage> {
  const opened = await openTransitionPackage(filePath, deps);
  const plan = await planTransitionPackage(opened, deps.installedRoot);
  const items: InspectedTransitionItem[] = opened.items.map(({ entry, refused }) => ({
    kind: namespacedId(opened.packId, entry.id),
    name: entry.name,
    version: entry.version,
    durationSeconds: entry.durationSeconds,
    sceneCopies: entry.sceneCopies,
    ...(entry.description ? { description: entry.description } : {}),
    ...(refused ? { refused } : {}),
  }));
  const { parsed } = opened;
  const head =
    parsed.format === 'pack'
      ? { name: parsed.manifest.name, version: parsed.manifest.version, author: parsed.manifest.author, license: parsed.manifest.license, description: parsed.manifest.description }
      : { name: parsed.entry.name, version: parsed.entry.version, author: parsed.author, license: parsed.license, description: parsed.entry.description };
  return {
    format: parsed.format,
    packId: opened.packId,
    name: head.name,
    version: head.version,
    ...(head.author ? { author: head.author } : {}),
    ...(head.license ? { license: head.license } : {}),
    ...(head.description ? { description: head.description } : {}),
    action: plan.action,
    ...(plan.installedVersion !== null ? { installedVersion: plan.installedVersion } : {}),
    items,
    problems: parsed.format === 'pack' ? parsed.problems : [],
  };
}
