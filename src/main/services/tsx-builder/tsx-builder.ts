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
import { MAX_TURNS_ERROR } from '../../../engine/providers/claude-session';
import { describeSystemPrompt } from '../tsx-jobs/project-store';
import { buildBuilderSystemPrompt, BUDGET_ROUNDS, EDIT_MIN_ROUNDS, MIN_ROUNDS } from './builder-prompt';
import { buildBuilderToolServer, builderToolName, BUILDER_MCP_SERVER_NAME, BUILDER_TOOL_IDS, type BuilderState } from './builder-tools';
import { buildFirstMessage } from './build-messages';
import { BuildProgress } from './build-progress';
import { capsFor, resolveStopReason, RunGuard, stopMessage } from './build-run-guard';
import { createRunDirs, projectNameFromId, pruneRunDirs, saveBuildVersion, seedWorkFromVersion, type SeededBuild } from './build-store';
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
    if (req.editOf) seed = await seedWorkFromVersion(req.editOf, dirs.workDir);
  } catch (err) {
    seedError = err instanceof Error ? err.message : String(err);
  }
  const format = req.format ?? seed?.format ?? null;
  const packs = req.packs ?? [];
  const state: BuilderState = {
    dirs,
    expect: format ?? { width: 0, height: 0, fps: 0 },
    roundsMax: BUDGET_ROUNDS[req.budget],
    roundsMin: seed ? EDIT_MIN_ROUNDS : MIN_ROUNDS[req.budget],
    roundsUsed: 0,
    checks: 0,
    phoneViews: 0,
    seamChecks: 0,
    lastGood: null,
    finished: null,
    stills: [],
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
  const firstMessage = buildFirstMessage({
    intent: req.intent,
    format,
    ...(req.brand ? { brand: req.brand } : {}),
    ...(req.referenceImages?.length ? { referenceImageCount: req.referenceImages.length } : {}),
    ...(seed ? { seed } : {}),
  });

  // One write at a time: concurrent appends land out of order.
  const transcriptPath = path.join(dirs.runDir, 'transcript.txt');
  let writes = Promise.resolve();
  const onTextDelta = (delta: string) => {
    writes = writes.then(() => fs.appendFile(transcriptPath, delta, 'utf-8')).catch(() => {});
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
        featureSource: 'tsx-generation',
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
      },
    );
  } finally {
    // Nothing reads a tool result once the session is over: stop what is still
    // running, and let it wind down before anything is saved or removed.
    guard.end();
    await Promise.allSettled([...state.inFlight]);
    await writes;
  }

  const maxTurnsHit = !response.success && response.error === MAX_TURNS_ERROR;
  const stopReason = resolveStopReason(state.finished !== null, guard.reason, maxTurnsHit);
  const kept = state.finished ?? state.lastGood;
  const base = {
    finished: state.finished !== null,
    stopReason,
    rounds: state.roundsUsed,
    checks: state.checks,
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
        ...(seed ? { editOf: { folderPath: seed.folderPath, version: seed.version, fromSrc: seed.fromSrc } } : {}),
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
