// Dev entry for the TSX builder (TSX_BUILDER_DESIGN.md §5). Dev builds only:
// main calls this when VIDTSX_TSX_BUILDER_SPIKE names a request JSON. No UI,
// no IPC. Everything it learns lands in `<outDir>/spike-report.json`.
//
// mode "fixture" — no model: copy an existing source folder into a run folder
// and measure the machinery (check, stills cold / warm / after an edit), then
// save it as a version and seed an edit from it (the build store, end to end).
// mode "build" — a real builder run on one brief, with craft packs read from
// a folder of skills (`<packsDir>/<name>/SKILL.md`, used verbatim).

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import { checkBuild } from './build-check';
import { renderBuildStills } from './build-stills';
import { createRunDirs, saveBuildVersion, seedWorkFromVersion } from './build-store';
import { buildComposition } from './tsx-builder';
import { formatFromConfig } from './build-format';
import type { CompositionConfig } from '../composition-config-parser';
import type { BuildBudget, BuildFormat, BuildPack } from './types';

const log = logEngine.createLogger('TsxBuilderSpike');

interface FixtureRequest {
  mode: 'fixture';
  sourceDir: string;
  outDir: string;
  frames?: number[];
  /** Quit the app when done (unattended runs). */
  quit?: boolean;
}

interface BuildSpikeRequest {
  mode: 'build';
  intent: string;
  /** Required unless `editOf` is given. */
  format?: BuildFormat;
  outDir: string;
  budget: BuildBudget;
  packsDir?: string;
  packNames?: string[];
  editOf?: { folderPath: string; version?: number };
  /** Default `<outDir>/projects`, so runs never land in the profile's Creator library unasked. */
  projectsDir?: string;
  name?: string;
  providerId?: string;
  model?: string;
  maxMinutes?: number;
  quit?: boolean;
}

type SpikeRequest = FixtureRequest | BuildSpikeRequest;

async function readPacks(dir: string, names?: string[]): Promise<BuildPack[]> {
  const entries = names ?? (await fs.readdir(dir)).sort();
  const packs: BuildPack[] = [];
  for (const name of entries) {
    const file = path.join(dir, name, 'SKILL.md');
    try {
      packs.push({ name, body: await fs.readFile(file, 'utf-8') });
    } catch {
      // not a skill folder
    }
  }
  return packs;
}

async function runBuild(req: BuildSpikeRequest): Promise<Record<string, unknown>> {
  const packs = req.packsDir ? await readPacks(req.packsDir, req.packNames) : [];
  const result = await buildComposition({
    intent: req.intent,
    ...(req.format ? { format: req.format } : {}),
    budget: req.budget,
    packs,
    ...(req.editOf ? { editOf: req.editOf } : {}),
    projectsDir: req.projectsDir ?? path.join(req.outDir, 'projects'),
    runsDir: path.join(req.outDir, 'runs'),
    ...(req.name ? { name: req.name } : {}),
    ...(req.providerId ? { providerId: req.providerId } : {}),
    ...(req.model ? { model: req.model } : {}),
    ...(req.maxMinutes ? { maxMinutes: req.maxMinutes } : {}),
  });
  const { code: _code, ...rest } = result;
  return { mode: 'build', packs: packs.map((p) => p.name), model: req.model ?? 'provider default', ...rest };
}

async function listTree(dir: string, rel = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(dir, rel), { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listTree(dir, child)));
    else out.push(child);
  }
  return out;
}

/** Save the fixture as a new project's v1, seed an edit from it, save that as v2. */
async function storeRoundTrip(
  req: FixtureRequest,
  kept: { code: string; config: CompositionConfig; stills: string[] },
): Promise<Record<string, unknown>> {
  const projectsDir = path.join(req.outDir, 'projects');
  await fs.rm(projectsDir, { recursive: true, force: true });
  const runsDir = path.join(req.outDir, 'runs');

  const first = await createRunDirs(runsDir);
  await fs.cp(req.sourceDir, first.workDir, { recursive: true });
  const v1 = await saveBuildVersion({
    target: { parentDir: projectsDir, name: 'fixture-store' },
    code: kept.code,
    dirs: first,
    stills: kept.stills.map((p, i) => ({ round: 1, frame: i, size: 'model' as const, path: p })),
    debug: { kind: 'tsx-builder', request: { format: formatFromConfig(kept.config, true) } },
  });

  const second = await createRunDirs(runsDir);
  const seed = await seedWorkFromVersion({ folderPath: v1.version.folderPath }, second.workDir);
  const v2 = await saveBuildVersion({
    target: { folderPath: seed.folderPath },
    code: kept.code,
    dirs: second,
    stills: [],
    debug: { kind: 'tsx-builder', edit: true },
  });
  return {
    v1: v1.version,
    v1Stills: v1.stills.length,
    seed: { version: seed.version, fromSrc: seed.fromSrc, format: seed.format, configId: seed.config?.id },
    v2: v2.version,
    projectFiles: await listTree(v1.version.folderPath),
  };
}

async function runFixture(req: FixtureRequest): Promise<Record<string, unknown>> {
  const workDir = path.join(req.outDir, 'work');
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.cp(req.sourceDir, workDir, { recursive: true });
  const frames = req.frames ?? [0, 60, 120, 180, 239];
  const rounds: Array<Record<string, unknown>> = [];
  type Kept = { code: string; config: CompositionConfig; stills: string[] };
  let lastGood: Kept | null = null;

  const round = async (name: string): Promise<boolean> => {
    const check = await checkBuild(workDir);
    const entry: Record<string, unknown> = {
      name,
      check: {
        ok: check.ok,
        errors: check.errors,
        ms: check.ms,
        inlinedFiles: check.inlinedFiles,
        inlinedPackages: check.inlinedPackages,
        bytes: check.code?.length ?? 0,
      },
    };
    rounds.push(entry);
    if (check.code) await fs.writeFile(path.join(req.outDir, `${name}.bundle.tsx`), check.code, 'utf-8');
    if (!check.ok || !check.code || !check.config) return false;
    const stills = await renderBuildStills(check.code, check.config, path.join(req.outDir, 'stills'), frames, {
      label: name,
    });
    entry.stills = {
      ms: stills.ms,
      bundleCached: stills.bundleCached,
      frames: stills.stills.map((s) => s.frame),
      paths: stills.stills.map((s) => s.path),
      modelImageBytes: stills.stills.map((s) => s.data.length),
    };
    lastGood = { code: check.code, config: check.config, stills: stills.stills.map((s) => s.path) };
    return true;
  };

  if (await round('r1-cold')) {
    await round('r2-warm');
    // A one-line edit: what every look-fix round actually costs.
    const entry = path.join(workDir, 'index.tsx');
    await fs.appendFile(entry, `\n// edited ${Date.now()}\n`, 'utf-8');
    await round('r3-edited');
  }
  const kept = lastGood as Kept | null;
  const store = kept ? await storeRoundTrip(req, kept) : null;
  return { mode: 'fixture', sourceDir: req.sourceDir, rounds, store };
}

export async function runBuilderSpikeFromEnv(): Promise<void> {
  const requestPath = process.env.VIDTSX_TSX_BUILDER_SPIKE;
  if (!requestPath || app.isPackaged) return;
  let req: SpikeRequest | null = null;
  const started = Date.now();
  let report: Record<string, unknown>;
  try {
    req = JSON.parse(await fs.readFile(requestPath, 'utf-8')) as SpikeRequest;
    await fs.mkdir(req.outDir, { recursive: true });
    log.info('Builder spike started', { mode: req.mode, outDir: req.outDir });
    report = req.mode === 'build' ? await runBuild(req) : await runFixture(req);
  } catch (err) {
    log.error('Builder spike failed', err);
    report = { error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err) };
  }
  report.totalMs = Date.now() - started;
  const outDir = req?.outDir ?? path.dirname(requestPath);
  await fs.writeFile(path.join(outDir, 'spike-report.json'), JSON.stringify(report, null, 2), 'utf-8');
  log.info('Builder spike done', { outDir, totalMs: report.totalMs });
  if (req?.quit) app.quit();
}
