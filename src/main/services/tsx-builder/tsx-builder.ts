// The TSX builder (TSX_BUILDER_DESIGN.md T1): ONE Agent SDK session that
// designs, writes files, checks, looks at rendered frames and redesigns,
// within a budget. `buildComposition(request) → BuildResult`; the run works in
// a scratch folder and the result is saved as the project's next version
// (build-store.ts).
//
// Security: the SDK file tools are confined to the work folder by the path
// guard, and they are deliberately NOT in `allowedTools` — a bare name there
// auto-approves the tool before `canUseTool` runs (T9 item 7). Only the
// builder's own MCP tools are allow-listed. No shell, no network tools.
//
// Stopping: cancel, the wall clock and the output-token cap all abort one
// RunGuard signal (build-run-guard.ts); tokens are counted per API response
// (LLMRequest.onTurn). The tools see the same signal, so a bundle or render
// in flight stops too, and the run waits for them before it saves.

import fs from 'fs/promises';
import path from 'path';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { createFileToolGuard } from '../agents/file-tool-guard';
import { getProjectsDir, getTsxBuildsDir } from '../../utils/paths';
import { releaseBundlesUnder } from '../remotion-bundler';
import { MAX_TURNS_ERROR } from '../../../engine/providers/claude-session';
import { describeSystemPrompt } from '../tsx-jobs/project-store';
import { buildBuilderSystemPrompt, BUDGET_ROUNDS, EDIT_MIN_ROUNDS, MIN_ROUNDS } from './builder-prompt';
import { buildBuilderToolServer, builderToolName, BUILDER_MCP_SERVER_NAME, BUILDER_TOOL_IDS, type BuilderState } from './builder-tools';
import { pureOkFor, seamOkFor } from './builder-tool-common';
import { buildFirstMessage } from './build-messages';
import { BuildProgress } from './build-progress';
import { capsFor, resolveStopReason, RunGuard, stopMessage } from './build-run-guard';
import { checkIntoFolder, createRunDirs, projectNameFromId, pruneRunDirs, saveBuildVersion } from './build-store';
import { seedWorkFromVersion, type SeededBuild } from './build-seed';
import { checkBuild } from './build-check';
import { ASSETS_DIR, listAssetFiles } from './build-assets';
import { attachRequestAssets, GENERATED_IMAGES_MAX, imageGenerationAvailable } from './builder-asset-tools';
import type { BuildRequest, BuildResult } from './types';

const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];

type LlmResponse = Awaited<ReturnType<typeof runLlmGenerate>>;

async function readEvents(runDir: string): Promise<unknown[]> {
  const raw = await fs.readFile(path.join(runDir, 'events.jsonl'), 'utf-8').catch(() => '');
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return { unparsed: line };
      }
    });
}

export async function buildComposition(req: BuildRequest): Promise<BuildResult> {
  const started = Date.now();
  const caps = capsFor(req.budget, req);
  const runsDir = req.runsDir ?? getTsxBuildsDir();
  await pruneRunDirs(runsDir).catch(() => 0);
  const dirs = await createRunDirs(runsDir);

  let seed: SeededBuild | null = null;
  let seedError: string | null = null;
  try {
    if (req.into && req.editOf) throw new Error('A build goes either into a new folder (into) or onto a version (editOf), not both.');
    if (req.into) await checkIntoFolder(req.into, { retake: req.retake === true });
    // A bundle changed by hand in place is diffed against vK.src/ bundled again, as `check` bundles it.
    if (req.editOf) seed = await seedWorkFromVersion(req.editOf, dirs.workDir, { rebundle: async (srcDir) => (await checkBuild(srcDir)).code ?? null });
    // After the seed: a request file that clashes with a version file is an error, not an overwrite.
    if (req.assets?.length) await attachRequestAssets(path.join(dirs.workDir, ASSETS_DIR), req.assets);
  } catch (err) {
    seedError = err instanceof Error ? err.message : String(err);
  }
  const format = req.format ?? seed?.format ?? null;
  const packs = req.packs ?? [];
  const state: BuilderState = {
    dirs,
    expect: format ?? { width: 0, height: 0, fps: 0 },
    ...(req.studioShot ? { studioShot: req.studioShot } : {}),
    roundsMax: BUDGET_ROUNDS[req.budget],
    roundsMin: seed ? EDIT_MIN_ROUNDS : MIN_ROUNDS[req.budget],
    roundsUsed: 0,
    lastLook: null,
    verifyLooks: 0,
    checks: 0,
    phoneViews: 0,
    seamChecks: 0,
    lastSeam: null,
    seamJumps: new Set(),
    purityChecks: 0,
    lastPurity: null,
    impureBuilds: new Set(),
    lastGood: null,
    finished: null,
    stills: [],
    imagesMax: Math.max(0, req.maxGeneratedImages ?? GENERATED_IMAGES_MAX[req.budget]),
    imagesGenerated: 0,
    imageCostUsd: 0,
    inFlight: new Set(),
  };
  // `guard` is read lazily: nothing is emitted before it exists.
  const progress = new BuildProgress(
    started,
    () => ({
      round: state.roundsUsed,
      roundsMax: state.roundsMax,
      checks: state.checks,
      turns: guard.turns,
      tokens: guard.tokens,
    }),
    req.onProgress,
  );
  const guard = new RunGuard(caps, req.signal, {
    onTurn: (usage) => progress.emit({ type: 'turn', turn: guard.turns, outputTokens: usage.outputTokens }),
    onStop: (reason) => progress.emit({ type: 'stopping', reason }),
  });
  state.signal = guard.signal;
  state.onEvent = (detail) => progress.emit(detail);
  state.onPhase = (phase) => progress.setPhase(phase);

  const counters = () => ({ turns: guard.turns, tokens: { ...guard.tokens }, caps });
  const done = (result: BuildResult): BuildResult => {
    progress.setPhase('done');
    progress.emit({
      type: 'done',
      stopReason: result.stopReason,
      ok: result.ok,
      ...(result.version ? { version: result.version.number } : {}),
    });
    return result;
  };

  if (seedError || !format) {
    const error =
      seedError ?? (seed ? 'The version to edit has no readable compositionConfig; give a format.' : 'A new build needs a format.');
    return done({
      ok: false,
      finished: false,
      stopReason: 'error',
      rounds: 0,
      checks: 0,
      stills: [],
      elapsedMs: Date.now() - started,
      ...counters(),
      runDir: dirs.runDir,
      error,
    });
  }

  const systemPrompt = buildBuilderSystemPrompt({ budget: req.budget, packs, minRounds: state.roundsMin });
  await fs.writeFile(path.join(dirs.runDir, 'system-prompt.md'), systemPrompt, 'utf-8');
  const startAssets = await listAssetFiles(path.join(dirs.workDir, ASSETS_DIR));
  const imageProvider = state.imagesMax > 0 ? await imageGenerationAvailable() : null;
  const firstMessage = buildFirstMessage({
    intent: req.intent,
    format,
    ...(req.brand ? { brand: req.brand } : {}),
    ...(req.referenceImages?.length ? { referenceImageCount: req.referenceImages.length } : {}),
    ...(seed ? { seed } : {}),
    ...(req.studioShot?.transparent ? { backdrop: req.studioShot.backdrop?.label ?? null } : {}),
    ...(startAssets.length ? { assets: startAssets } : {}),
    ...(imageProvider?.ok ? { imageGeneration: { provider: imageProvider.provider, max: state.imagesMax } } : {}),
    ...(imageProvider && !imageProvider.ok ? { imageGenerationOff: imageProvider.reason } : {}),
  });

  // One write at a time: concurrent appends land out of order.
  const transcriptPath = path.join(dirs.runDir, 'transcript.txt');
  let writes = Promise.resolve();
  const onTextDelta = (delta: string) => {
    writes = writes.then(() => fs.appendFile(transcriptPath, delta, 'utf-8')).catch(() => {});
    try {
      req.onText?.(delta);
    } catch {
      /* a listener must not break the run */
    }
  };

  progress.emit({ type: 'start', budget: req.budget, caps, roundsMin: state.roundsMin, edit: seed !== null });
  guard.arm();
  progress.setPhase('working');
  let response: LlmResponse;
  try {
    response = await runLlmGenerate(
      {
        prompt: firstMessage,
        systemPrompt,
        featureSource: req.usage?.featureSource ?? 'tsx-generation',
        maxTurns: caps.turns,
        thinking: { type: 'adaptive' },
        effort: req.effort ?? 'medium',
        agentTools: FILE_TOOLS,
        allowedTools: BUILDER_TOOL_IDS.map(builderToolName),
        ...(req.referenceImages?.length ? { images: req.referenceImages } : {}),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        ...(req.model ? { model: req.model } : {}),
      },
      guard.signal,
      onTextDelta,
      {
        mcpServers: { [BUILDER_MCP_SERVER_NAME]: buildBuilderToolServer(state) },
        cwd: dirs.workDir,
        canUseTool: createFileToolGuard(dirs.workDir),
        onTurn: (usage) => guard.addTurn(usage),
        ...(req.usage?.agentId ? { agentId: req.usage.agentId } : {}),
      },
    );
  } finally {
    // Nothing reads a tool result once the session is over: stop what is still
    // running, and let it wind down before anything is saved or removed.
    guard.end();
    await Promise.allSettled([...state.inFlight]);
    await writes;
    // The looks' bundles serve nothing after the run (bundle-cache-prune.ts).
    await releaseBundlesUnder(dirs.runDir).catch(() => 0);
  }

  const maxTurnsHit = !response.success && response.error === MAX_TURNS_ERROR;
  const stopReason = resolveStopReason(state.finished !== null, guard.reason, maxTurnsHit);
  const kept = state.finished ?? state.lastGood;
  const base = {
    finished: state.finished !== null,
    stopReason,
    rounds: state.roundsUsed,
    checks: state.checks,
    ...(format.loop && kept ? { seamOk: seamOkFor(state, kept.code) } : {}),
    ...(kept?.physics ? { pureOk: pureOkFor(state, kept.code) } : {}),
    ...(state.imagesGenerated > 0 ? { images: { count: state.imagesGenerated, costUsd: state.imageCostUsd } } : {}),
    ...counters(),
    ...(response.usage ? { usage: response.usage } : {}),
    ...(state.finished ? { summary: state.finished.summary } : {}),
  };
  const error = stopMessage(stopReason, caps, response.success ? undefined : response.error);

  // Cancel keeps nothing (the run folder stays); every other stop keeps the
  // last build that passed check — a capped run never ends with nothing.
  if (!kept || stopReason === 'cancelled') {
    // Relative to the run folder, which is kept.
    const stills = state.stills.map((s) => ({
      round: s.round,
      frame: s.frame,
      size: s.size,
      file: path.relative(dirs.runDir, s.path).split(path.sep).join('/'),
    }));
    return done({ ...base, ok: false, stills, elapsedMs: Date.now() - started, runDir: dirs.runDir, ...(error ? { error } : {}) });
  }

  progress.setPhase('saving');
  const transcript = await fs.readFile(transcriptPath, 'utf-8').catch(() => '');
  const elapsedMs = Date.now() - started;
  const saved = await saveBuildVersion({
    target: seed
      ? { folderPath: seed.folderPath }
      : req.into
        ? { folderPath: req.into }
        : { parentDir: req.projectsDir ?? getProjectsDir(), name: req.name ?? projectNameFromId(kept.config.id) },
    code: kept.code,
    dirs,
    stills: state.stills,
    debug: {
      kind: 'tsx-builder',
      model: response.model ?? req.model,
      durationMs: elapsedMs,
      timestamp: new Date().toISOString(),
      prompt: req.intent,
      request: {
        budget: req.budget,
        format,
        packs: packs.map((p) => p.name),
        ...(req.brand ? { brand: req.brand } : {}),
        referenceImages: req.referenceImages?.length ?? 0,
        ...(req.assets?.length ? { assets: req.assets.map((a) => a.name ?? path.basename(a.path)) } : {}),
        maxGeneratedImages: state.imagesMax,
        ...(seed
          ? {
              editOf: {
                folderPath: seed.folderPath,
                version: seed.version,
                seed: seed.kind,
                ...(seed.srcVersion !== undefined ? { srcVersion: seed.srcVersion } : {}),
                ...(seed.handEditLines !== undefined ? { handEditLines: seed.handEditLines } : {}),
                ...(seed.bundle ? { bundle: true } : {}),
              },
            }
          : {}),
        ...(req.into ? { into: req.into } : {}),
        ...(req.retake ? { retake: true } : {}),
        ...(req.studioShot
          ? {
              studioShot: {
                transparent: req.studioShot.transparent,
                ...(req.studioShot.backdrop
                  ? { backdrop: { file: req.studioShot.backdrop.file, startSeconds: req.studioShot.backdrop.startSeconds } }
                  : {}),
              },
            }
          : {}),
        ...(req.usage ? { usage: req.usage } : {}),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        effort: req.effort ?? 'medium',
      },
      ...base,
      // `turns` below is the transcript; the API-turn count goes here.
      apiTurns: base.turns,
      ...(error ? { error } : {}),
      ...(state.finished ? {} : { keptCheck: state.lastGood?.check }),
      usage: response.usage,
      events: await readEvents(dirs.runDir),
      // The Creator's debug panel reads `turns` as strings: the builder's narration.
      turns: transcript ? [transcript] : [],
      ...describeSystemPrompt(systemPrompt),
    },
  });
  await fs.rm(dirs.runDir, { recursive: true, force: true }).catch(() => {});

  return done({
    ...base,
    ok: true,
    version: saved.version,
    code: kept.code,
    config: kept.config,
    stills: saved.stills,
    elapsedMs,
    ...(error ? { error } : {}),
  });
}
