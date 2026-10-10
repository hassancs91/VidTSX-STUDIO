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
import { createRunDirs, projectNameFromId, pruneRunDirs, saveBuildVersion, seedWorkFromVersion, type SeededBuild } from './build-store';
import type { BuildBudget, BuildRequest, BuildResult, BuildStopReason } from './types';

const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
/** SDK turns per budget: generous — the look budget is the real limit. */
const MAX_TURNS: Record<BuildBudget, number> = { quick: 40, standard: 90, craft: 200 };
const MAX_MINUTES: Record<BuildBudget, number> = { quick: 15, standard: 30, craft: 60 };

type LlmResponse = Awaited<ReturnType<typeof runLlmGenerate>>;

function stopReasonOf(state: BuilderState, response: LlmResponse, cancelled: boolean, timedOut: boolean): BuildStopReason {
  if (state.finished) return 'finished';
  if (cancelled) return 'cancelled';
  if (timedOut) return 'cap-time';
  if (!response.success && response.error === MAX_TURNS_ERROR) return 'cap-turns';
  return 'error';
}

function stopError(reason: BuildStopReason, response: LlmResponse, capMinutes: number): string | undefined {
  switch (reason) {
    case 'finished':
      return undefined;
    case 'cancelled':
      return 'Cancelled.';
    case 'cap-time':
      return `Stopped at the ${capMinutes}-minute cap.`;
    case 'cap-turns':
      return response.error;
    default:
      return response.success ? 'The builder stopped without calling finish.' : response.error;
  }
}

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
  const runsDir = req.runsDir ?? getTsxBuildsDir();
  await pruneRunDirs(runsDir).catch(() => 0);
  const dirs = await createRunDirs(runsDir);

  const empty = { ok: false, finished: false, rounds: 0, checks: 0, stills: [], runDir: dirs.runDir };
  let seed: SeededBuild | null = null;
  try {
    if (req.editOf) seed = await seedWorkFromVersion(req.editOf, dirs.workDir);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ...empty, stopReason: 'error', elapsedMs: Date.now() - started, error };
  }
  const format = req.format ?? seed?.format ?? null;
  if (!format) {
    const error = seed ? 'The version to edit has no readable compositionConfig; give a format.' : 'A new build needs a format.';
    return { ...empty, stopReason: 'error', elapsedMs: Date.now() - started, error };
  }

  const packs = req.packs ?? [];
  const state: BuilderState = {
    dirs,
    expect: format,
    roundsMax: BUDGET_ROUNDS[req.budget],
    roundsMin: seed ? EDIT_MIN_ROUNDS : MIN_ROUNDS[req.budget],
    roundsUsed: 0,
    checks: 0,
    lastGood: null,
    finished: null,
    stills: [],
  };

  const systemPrompt = buildBuilderSystemPrompt({ budget: req.budget, packs, minRounds: state.roundsMin });
  await fs.writeFile(path.join(dirs.runDir, 'system-prompt.md'), systemPrompt, 'utf-8');
  const firstMessage = buildFirstMessage({
    intent: req.intent,
    format,
    ...(req.brand ? { brand: req.brand } : {}),
    ...(req.referenceImages?.length ? { referenceImageCount: req.referenceImages.length } : {}),
    ...(seed ? { seed } : {}),
  });

  // Wall-clock cap, joined with the caller's signal.
  const abort = new AbortController();
  const capMinutes = req.maxMinutes ?? MAX_MINUTES[req.budget];
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    abort.abort();
  }, capMinutes * 60_000);
  const onCallerAbort = () => abort.abort();
  req.signal?.addEventListener('abort', onCallerAbort, { once: true });

  // One write at a time: concurrent appends land out of order.
  const transcriptPath = path.join(dirs.runDir, 'transcript.txt');
  let writes = Promise.resolve();
  const onTextDelta = (delta: string) => {
    writes = writes.then(() => fs.appendFile(transcriptPath, delta, 'utf-8')).catch(() => {});
  };

  let response: LlmResponse;
  try {
    response = await runLlmGenerate(
      {
        prompt: firstMessage,
        systemPrompt,
        featureSource: 'tsx-generation',
        maxTurns: MAX_TURNS[req.budget],
        thinking: { type: 'adaptive' },
        effort: req.effort ?? 'medium',
        agentTools: FILE_TOOLS,
        allowedTools: BUILDER_TOOL_IDS.map(builderToolName),
        ...(req.referenceImages?.length ? { images: req.referenceImages } : {}),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        ...(req.model ? { model: req.model } : {}),
      },
      abort.signal,
      onTextDelta,
      {
        mcpServers: { [BUILDER_MCP_SERVER_NAME]: buildBuilderToolServer(state) },
        cwd: dirs.workDir,
        canUseTool: createFileToolGuard(dirs.workDir),
      },
    );
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onCallerAbort);
    await writes;
  }

  const stopReason = stopReasonOf(state, response, req.signal?.aborted === true, timedOut);
  const kept = state.finished ?? state.lastGood;
  const base = {
    finished: state.finished !== null,
    stopReason,
    rounds: state.roundsUsed,
    checks: state.checks,
    ...(response.usage ? { usage: response.usage } : {}),
    ...(state.finished ? { summary: state.finished.summary } : {}),
  };
  const error = stopError(stopReason, response, capMinutes);

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
    return { ...base, ok: false, stills, elapsedMs: Date.now() - started, runDir: dirs.runDir, ...(error ? { error } : {}) };
  }

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

  return {
    ...base,
    ok: true,
    version: saved.version,
    code: kept.code,
    config: kept.config,
    stills: saved.stills,
    elapsedMs,
    ...(error ? { error } : {}),
  };
}
