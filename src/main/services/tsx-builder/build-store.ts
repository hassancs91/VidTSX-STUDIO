// Where a build lives (TSX_BUILDER_DESIGN.md T3).
//
// A run works in a scratch folder, `<runsDir>/<runId>/`: work/ (the builder's
// files), stills/, checkpoints/, events.jsonl, transcript.txt. Only a result
// touches the project folder:
//   vN.tsx         the single-file bundle every consumer reads
//   vN.src/        the builder's files — what the next edit continues from
//   vN.assets/     the files its staticFile() calls load (work/assets/), when
//                  there are any: whoever plays vN.tsx maps them to its
//                  `assets` prop. A file the version before already had, byte
//                  for byte, is a hard link to it (saved versions are never
//                  written again), so an HDRI does not cost its size per edit.
//   vN.stills/     the frames it looked at, at the size it saw them
//   vN.debug.json  rounds, events, usage, the transcript (as `turns`)
// The Creator library shows a folder with no vN.tsx as an empty group
// (library-scanner.ts), so a run in progress, cancelled or failed never
// creates a project folder.

import fs from 'fs/promises';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { reserveProjectFolder, writeNextVersion, writeDebugSidecar } from '../tsx-jobs/project-store';
import { ASSETS_DIR, HAND_EDITS_FILE } from './constants';
import type { BuildStillRecord, BuildStillSize, BuildVersion } from './types';

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

/**
 * A request's `into`: the folder exists and holds no version yet (a version to
 * continue is `editOf`). A `retake` may build into a folder that holds versions:
 * it is saved as the next one.
 */
export async function checkIntoFolder(folderPath: string, options: { retake?: boolean } = {}): Promise<void> {
  if (!(await fs.stat(folderPath).catch(() => null))?.isDirectory()) throw new Error(`The folder to build into does not exist: ${folderPath}`);
  if (options.retake) return;
  const last = (await listVersionNumbers(folderPath)).pop();
  if (last !== undefined) throw new Error(`The folder to build into already holds v${last}: continue it with editOf instead (${folderPath})`);
}

export async function listVersionNumbers(folderPath: string): Promise<number[]> {
  const entries = await fs.readdir(folderPath).catch(() => [] as string[]);
  return entries
    .map((e) => VERSION_PATTERN.exec(e))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function isDirectory(p: string): Promise<boolean> {
  const stat = await fs.stat(p).catch(() => null);
  return stat?.isDirectory() === true;
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

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Files under `dir`, as POSIX paths relative to it. */
async function filesUnder(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

/** The newest `vK.assets/` with K below `number`, or null. */
async function previousAssetsDir(folderPath: string, number: number): Promise<string | null> {
  const earlier = (await listVersionNumbers(folderPath)).filter((n) => n < number).reverse();
  for (const n of earlier) {
    const dir = path.join(folderPath, `v${n}.assets`);
    if (await isDirectory(dir)) return dir;
  }
  return null;
}

/**
 * Copy the run's assets/ to `target`; a file identical to the same path in
 * `previous` (size, then SHA-256) becomes a hard link to it instead. Returns
 * the files saved and how many were linked. A failed link (another volume, a
 * file system without links) falls back to a copy.
 */
export async function saveAssetsFolder(
  source: string,
  target: string,
  previous: string | null,
): Promise<{ files: string[]; linked: number }> {
  const files = await filesUnder(source);
  let linked = 0;
  await fs.rm(target, { recursive: true, force: true });
  for (const rel of files) {
    const from = path.join(source, ...rel.split('/'));
    const to = path.join(target, ...rel.split('/'));
    await fs.mkdir(path.dirname(to), { recursive: true });
    const before = previous ? path.join(previous, ...rel.split('/')) : null;
    if (before) {
      const [a, b] = await Promise.all([fs.stat(from), fs.stat(before).catch(() => null)]);
      if (b?.isFile() && a.size === b.size && (await sha256File(from)) === (await sha256File(before))) {
        const ok = await fs.link(before, to).then(
          () => true,
          () => false,
        );
        if (ok) {
          linked += 1;
          continue;
        }
      }
    }
    await fs.copyFile(from, to);
  }
  return { files, linked };
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
  const workAssets = path.join(input.dirs.workDir, ASSETS_DIR);
  // Not saved: assets/ (its own folder below) and an edit's HAND-EDITS.diff (carried over by now; stale for the next edit).
  const skip = new Set([path.resolve(workAssets), path.resolve(input.dirs.workDir, HAND_EDITS_FILE)]);
  await fs.cp(input.dirs.workDir, srcDir, { recursive: true, filter: (from) => !skip.has(path.resolve(from)) });

  // Cleared first: N is reused after the top version is deleted, and its old files must not serve this one.
  const assetsDir = path.join(folderPath, `${base}.assets`);
  await fs.rm(assetsDir, { recursive: true, force: true });
  let assets: { dir: string; files: string[]; linked: number } | null = null;
  if ((await filesUnder(workAssets)).length > 0) {
    const saved = await saveAssetsFolder(workAssets, assetsDir, await previousAssetsDir(folderPath, number));
    assets = { dir: assetsDir, ...saved };
  }

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

  await writeDebugSidecar(tsxPath, {
    ...input.debug,
    // What vN.tsx is as saved: an edit tells a hand change from the builder's bundle by it (build-seed.ts).
    artifactSha256: sha256Text(input.code),
    stills,
    ...(assets ? { assets: { files: assets.files, linkedFromPrevious: assets.linked } } : {}),
  });
  return {
    version: {
      number,
      folderPath,
      tsxPath,
      srcDir,
      stillsDir,
      ...(assets ? { assetsDir: assets.dir } : {}),
      debugPath: tsxPath.replace(/\.tsx$/, '.debug.json'),
    },
    stills,
  };
}
