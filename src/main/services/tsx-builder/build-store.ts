// Where a build lives (TSX_BUILDER_DESIGN.md T3).
//
// A run works in a scratch folder, `<runsDir>/<runId>/`: work/ (the builder's
// files), stills/, checkpoints/, events.jsonl, transcript.txt. Only a result
// touches the project folder:
//   vN.tsx         the single-file bundle every consumer reads
//   vN.src/        the builder's files — what the next edit continues from
//   vN.stills/     the frames it looked at, at the size it saw them
//   vN.debug.json  rounds, events, usage, the transcript (as `turns`)
// The Creator library shows a folder with no vN.tsx as an empty group
// (library-scanner.ts), so a run in progress, cancelled or failed never
// creates a project folder.

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { reserveProjectFolder, writeNextVersion, writeDebugSidecar } from '../tsx-jobs/project-store';
import { parseCompositionConfig, type CompositionConfig } from '../composition-config-parser';
import { BUILD_ENTRY } from './constants';
import { formatFromConfig } from './build-format';
import type { BuildFormat, BuildStillRecord, BuildStillSize, BuildVersion } from './types';

const VERSION_PATTERN = /^v(\d+)\.tsx$/;
const RUN_PATTERN = /^b\d+-[0-9a-f]{6}$/;
/** Run folders kept for inspection; a successful run's folder is removed after its save. */
export const RUNS_KEPT = 10;

export interface RunDirs {
  runId: string;
  runDir: string;
  workDir: string;
  stillsDir: string;
}

export async function createRunDirs(runsDir: string): Promise<RunDirs> {
  const runId = `b${Date.now()}-${randomUUID().slice(0, 6)}`;
  const runDir = path.join(runsDir, runId);
  const dirs = { runId, runDir, workDir: path.join(runDir, 'work'), stillsDir: path.join(runDir, 'stills') };
  await fs.mkdir(dirs.workDir, { recursive: true });
  await fs.mkdir(dirs.stillsDir, { recursive: true });
  return dirs;
}

/** Oldest run folders past `keep` are deleted. Only names this store minted are touched. */
export async function pruneRunDirs(runsDir: string, keep = RUNS_KEPT): Promise<number> {
  const entries = await fs.readdir(runsDir, { withFileTypes: true }).catch(() => []);
  const runs = entries.filter((e) => e.isDirectory() && RUN_PATTERN.test(e.name)).map((e) => e.name);
  // The name starts with its creation time, so a name sort is an age sort.
  const stale = runs.sort().slice(0, Math.max(0, runs.length - keep));
  for (const name of stale) {
    await fs.rm(path.join(runsDir, name), { recursive: true, force: true });
  }
  return stale.length;
}

export async function listVersionNumbers(folderPath: string): Promise<number[]> {
  const entries = await fs.readdir(folderPath).catch(() => [] as string[]);
  return entries
    .map((e) => VERSION_PATTERN.exec(e))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

export interface SeededBuild {
  version: number;
  folderPath: string;
  /** False when the version predates the builder: the work folder holds its one file. */
  fromSrc: boolean;
  config: CompositionConfig | null;
  /** The format the version was built to, when it can be told. */
  format: BuildFormat | null;
}

async function isDirectory(p: string): Promise<boolean> {
  const stat = await fs.stat(p).catch(() => null);
  return stat?.isDirectory() === true;
}

async function readBuilderFormat(debugPath: string): Promise<BuildFormat | null> {
  try {
    const debug = JSON.parse(await fs.readFile(debugPath, 'utf-8')) as {
      kind?: string;
      request?: { format?: BuildFormat };
    };
    return debug.kind === 'tsx-builder' && debug.request?.format ? debug.request.format : null;
  } catch {
    return null;
  }
}

/**
 * Fill `workDir` from a saved version so an edit continues where it stopped:
 * the builder's own `vN.src/` when there is one, otherwise the version's single
 * file as `index.tsx` (any Creator version is a valid one-file source).
 */
export async function seedWorkFromVersion(
  editOf: { folderPath: string; version?: number },
  workDir: string,
): Promise<SeededBuild> {
  const versions = await listVersionNumbers(editOf.folderPath);
  const version = editOf.version ?? versions[versions.length - 1];
  if (version === undefined || !versions.includes(version)) {
    throw new Error(
      editOf.version !== undefined
        ? `v${editOf.version}.tsx not found in ${editOf.folderPath}`
        : `No version to edit in ${editOf.folderPath}`,
    );
  }
  const tsxPath = path.join(editOf.folderPath, `v${version}.tsx`);
  const srcDir = path.join(editOf.folderPath, `v${version}.src`);
  const code = await fs.readFile(tsxPath, 'utf-8');
  const fromSrc = await isDirectory(srcDir);
  if (fromSrc) {
    await fs.cp(srcDir, workDir, { recursive: true });
  } else {
    await fs.writeFile(path.join(workDir, BUILD_ENTRY), code, 'utf-8');
  }
  const config = parseCompositionConfig(code);
  const format =
    (await readBuilderFormat(path.join(editOf.folderPath, `v${version}.debug.json`))) ??
    (config ? formatFromConfig(config) : null);
  return { version, folderPath: editOf.folderPath, fromSrc, config, format };
}

/** "CompoundInterestCoins" → "compound-interest-coins" (reserveProjectFolder sanitizes the rest). */
export function projectNameFromId(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

/** An image the builder was shown, still in the run folder. */
export interface BuildStillShown {
  round: number;
  frame: number;
  size: BuildStillSize;
  /** A sheet only: every frame in it. */
  frames?: number[];
  path: string;
}

export interface SaveVersionInput {
  /** An edit adds to its folder; a new build reserves one. */
  target: { folderPath: string } | { parentDir: string; name: string };
  code: string;
  dirs: RunDirs;
  stills: BuildStillShown[];
  /** Written as vN.debug.json, with the saved stills added. */
  debug: Record<string, unknown>;
}

/**
 * Save a build as the folder's next version. `vN.tsx` is claimed first (the
 * exclusive write in writeNextVersion), so two saves into one folder never share
 * an N; its src/stills/debug follow under that N.
 */
export async function saveBuildVersion(
  input: SaveVersionInput,
): Promise<{ version: BuildVersion; stills: BuildStillRecord[] }> {
  const folderPath =
    'folderPath' in input.target
      ? input.target.folderPath
      : (await reserveProjectFolder(input.target.name, input.target.parentDir)).folderPath;
  const tsxPath = await writeNextVersion(folderPath, input.code);
  const number = Number(VERSION_PATTERN.exec(path.basename(tsxPath))![1]);
  const base = `v${number}`;

  const srcDir = path.join(folderPath, `${base}.src`);
  await fs.rm(srcDir, { recursive: true, force: true });
  await fs.cp(input.dirs.workDir, srcDir, { recursive: true });

  const stillsDir = path.join(folderPath, `${base}.stills`);
  await fs.rm(stillsDir, { recursive: true, force: true });
  await fs.mkdir(stillsDir, { recursive: true });
  const stills: BuildStillRecord[] = [];
  for (const still of input.stills) {
    const name = path.basename(still.path);
    const copied = await fs.copyFile(still.path, path.join(stillsDir, name)).then(
      () => true,
      () => false,
    );
    if (!copied) continue;
    const { path: _from, ...record } = still;
    stills.push({ ...record, file: `${base}.stills/${name}` });
  }

  await writeDebugSidecar(tsxPath, { ...input.debug, stills });
  return {
    version: { number, folderPath, tsxPath, srcDir, stillsDir, debugPath: tsxPath.replace(/\.tsx$/, '.debug.json') },
    stills,
  };
}
