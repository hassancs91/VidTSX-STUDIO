// Dev entry for the TSX builder (TSX_BUILDER_DESIGN.md §5). Dev builds only:
// main calls this when VIDTSX_TSX_BUILDER_SPIKE names a request JSON. No UI,
// no IPC. Everything it learns lands in `<outDir>/spike-report.json`.
//
// mode "fixture" — no model: copy an existing source folder into a run folder
// and measure the machinery (check, stills cold / warm / after an edit), then
// save it as a version and seed an edit from it (the build store, end to end).
// Probes (builder-spike-probes.ts): `cancelProbes` aborts a stills call
// mid-flight twice and renders once more; `concurrentProbe` renders two
// different bundles at the same time and checks each still against its own
// solo render; `exportProbe` runs the render-handlers path (bundle +
// renderComposition) for one second of H.264; `lookProbe` saves a contact
// sheet + phone view of the fixture and measures its seam; `seamSources` runs
// loop_seam on loops whose verdict is known.
// mode "build" — a real run on one brief as a `build` job on tsxJobEngine (the
// path the app runs; builder-spike-job.ts), with craft packs read from a
// folder of skills (`<packsDir>/<name>/SKILL.md`, sent verbatim as the job's
// pack bodies). Every job event (the whole snapshot) and every narration chunk
// lands in `<outDir>/progress.jsonl`; `cancelAfterMs` cancels the job. The
// job saves into the profile's Creator library, as the app does; the project
// is copied to `<outDir>/projects/`. A job cannot force the one-shot pipeline:
// part 5's check of it stays in runs/P1/fallback-p5.
// mode "engines" — free: which engine each provider would get, and why.
// mode "libraries" — free: one source per area of the library set through
// `check` and the stills path (builder-spike-libraries.ts, P2 part 1).
// mode "gl" — free: the probed GL backend, and each source's stills timed on
// it and on `swangle`, with pixel diffs (builder-spike-gl.ts, P2 part 2).
// mode "purity" — free: each source through `check` and the frame-purity look,
// against the verdict it should get (builder-spike-purity.ts, P2 part 3).
// mode "assets" — free: sources with an assets/ folder through `check`, every
// look, a saved version's preview files and an export (builder-spike-assets.ts,
// P2 part 4).
// mode "toolwait" — how long an agent's MCP tool call may block, on a cheap
// model: wait / server timeout / abort cases (builder-spike-toolwait.ts, P3
// part 4's probe). Writes `<outDir>/report.json`.

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import { checkBuild } from './build-check';
import { renderBuildStills } from './build-stills';
import { releaseBundlesUnder } from '../remotion-bundler';
import { createRunDirs, saveBuildVersion } from './build-store';
import { seedWorkFromVersion } from './build-seed';
import { tsxJobEngine } from '../tsx-jobs/tsx-job-engine';
import { getTsxBuildsDir } from '../../utils/paths';
import { enginesProbe, registerProviderFromEnv } from './builder-spike-dispatch';
import { followJob, jobRequestFor, keepJobResult, type BuildSpikeRequest } from './builder-spike-job';
import { cancelProbes, concurrentProbe, exportProbe, lookProbe, seamProbe, type SeamSource } from './builder-spike-probes';
import { libraryProbe, type LibrariesRequest } from './builder-spike-libraries';
import { glTimingProbe, type GlTimingRequest } from './builder-spike-gl';
import { purityProbe, type PurityRequest } from './builder-spike-purity';
import { assetsProbe, type AssetsRequest } from './builder-spike-assets';
import { toolWaitProbe, type ToolWaitRequest } from './builder-spike-toolwait';
import { formatFromConfig } from './build-format';
import type { CompositionConfig } from '../composition-config-parser';
import type { BuildPack } from './types';

const log = logEngine.createLogger('TsxBuilderSpike');

interface FixtureRequest {
  mode: 'fixture';
  sourceDir: string;
  outDir: string;
  frames?: number[];
  cancelProbes?: boolean;
  concurrentProbe?: boolean;
  exportProbe?: boolean;
  lookProbe?: boolean;
  seamSources?: SeamSource[];
  /** P2 part 5: after the rounds, release the stills entry's bundles as a builder run's end does. */
  releaseProbe?: boolean;
  /** Quit the app when done (unattended runs). */
  quit?: boolean;
}

interface EnginesRequest {
  mode: 'engines';
  outDir: string;
  quit?: boolean;
}

type SpikeRequest =
  | FixtureRequest
  | BuildSpikeRequest
  | EnginesRequest
  | LibrariesRequest
  | GlTimingRequest
  | PurityRequest
  | AssetsRequest
  | ToolWaitRequest;

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
  if ('engine' in req || 'projectsDir' in req) {
    return { error: 'A build job takes neither "engine" nor "projectsDir" (part 5\'s pipeline check: runs/P1/fallback-p5).' };
  }
  const packs = req.packsDir ? await readPacks(req.packsDir, req.packNames) : [];
  const progressPath = path.join(req.outDir, 'progress.jsonl');
  await fs.rm(progressPath, { force: true });
  let writes = Promise.resolve();
  const writeLine = (entry: object) => {
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`;
    writes = writes.then(() => fs.appendFile(progressPath, line, 'utf-8')).catch(() => {});
  };
  // A BYOK preset the throwaway profile has no key for: `<ID>_API_KEY`, this run only.
  const envProvider = req.providerId ? registerProviderFromEnv(req.providerId) : false;
  const followed = await followJob(tsxJobEngine, jobRequestFor(req, packs), {
    write: writeLine,
    ...(req.cancelAfterMs ? { cancelAfterMs: req.cancelAfterMs } : {}),
  });
  await writes;
  const { final, ...job } = followed;
  return {
    mode: 'build',
    via: 'tsx-job',
    packs: packs.map((p) => p.name),
    providerId: req.providerId ?? 'engine default',
    envProvider,
    requestedModel: req.model ?? 'provider default',
    ...job,
    // A run that saved nothing keeps its folder here (transcript, events).
    runsDir: getTsxBuildsDir(),
    result: final ? await keepJobResult(final, req.outDir) : null,
    final: final ?? null,
  };
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
    seed: { version: seed.version, kind: seed.kind, format: seed.format, configId: seed.config?.id },
    v2: v2.version,
    projectFiles: await listTree(v1.version.folderPath),
  };
}

async function runFixture(req: FixtureRequest): Promise<Record<string, unknown>> {
  const bundleCacheDir = path.join(app.getPath('userData'), 'bundle-cache');
  const bundlesAtStart = new Set(await fs.readdir(bundleCacheDir).catch(() => [] as string[]));
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
  // What a builder run's end does (tsx-builder.ts): every bundle made from an entry in the folder
  // goes, r1's too, which r3's re-bundle of the same entry path replaced in the bundler's map.
  let release: Record<string, unknown> | null = null;
  if (req.releaseProbe) {
    // A change that survives bundling (r3's comment does not), so the same entry path is re-bundled.
    await fs.appendFile(path.join(workDir, 'index.tsx'), `\nexport const releaseProbeMark = ${Date.now()};\n`, 'utf-8');
    await round('r4-rebundled');
    const made = (await fs.readdir(bundleCacheDir).catch(() => [] as string[])).filter((n) => !bundlesAtStart.has(n));
    const released = await releaseBundlesUnder(path.join(req.outDir, 'stills'));
    const left = (await fs.readdir(bundleCacheDir).catch(() => [] as string[])).filter((n) => !bundlesAtStart.has(n));
    release = { made, released, left };
  }
  const kept = lastGood as Kept | null;
  const store = kept ? await storeRoundTrip(req, kept) : null;
  const fx = kept ? { outDir: req.outDir, code: kept.code, config: kept.config, frames, soloStills: kept.stills } : null;
  const cancel = fx && req.cancelProbes ? await cancelProbes(fx) : null;
  const concurrent = fx && req.concurrentProbe ? await concurrentProbe(fx) : null;
  const exported = fx && req.exportProbe ? await exportProbe(fx) : null;
  const looks = fx && req.lookProbe ? await lookProbe(fx) : null;
  const seams = req.seamSources?.length ? await seamProbe(req.outDir, req.seamSources) : null;
  return { mode: 'fixture', sourceDir: req.sourceDir, rounds, release, store, cancel, concurrent, export: exported, looks, seams };
}

export async function runBuilderSpikeFromEnv(): Promise<void> {
  const requestPath = process.env.VIDTSX_TSX_BUILDER_SPIKE;
  // Packaged: only a probe build (`electron-vite build --mode probe`, main/index.ts).
  if (!requestPath || (app.isPackaged && import.meta.env.MODE !== 'probe')) return;
  let req: SpikeRequest | null = null;
  const started = Date.now();
  let report: Record<string, unknown>;
  try {
    req = JSON.parse(await fs.readFile(requestPath, 'utf-8')) as SpikeRequest;
    await fs.mkdir(req.outDir, { recursive: true });
    log.info('Builder spike started', { mode: req.mode, outDir: req.outDir });
    report =
      req.mode === 'build'
        ? await runBuild(req)
        : req.mode === 'engines'
          ? await enginesProbe()
          : req.mode === 'libraries'
            ? await libraryProbe(req.outDir, req.sources)
            : req.mode === 'gl'
              ? await glTimingProbe(req.outDir, req.sources)
              : req.mode === 'purity'
                ? await purityProbe(req.outDir, req.sources)
                : req.mode === 'assets'
                  ? await assetsProbe(req.outDir, req.sources)
                  : req.mode === 'toolwait'
                    ? await toolWaitProbe(req)
                    : await runFixture(req);
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
