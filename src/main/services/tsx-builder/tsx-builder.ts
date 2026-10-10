// The TSX builder (TSX_BUILDER_DESIGN.md T1): ONE Agent SDK session that
// designs, writes files, checks, looks at rendered frames and redesigns,
// within a budget. P0 shape — the request/result types grow in P1.
//
// Security: the SDK file tools are confined to the build folder by the path
// guard, and they are deliberately NOT in `allowedTools` — a bare name there
// auto-approves the tool before `canUseTool` runs (T9 item 7). Only the
// builder's own MCP tools are allow-listed. No shell, no network tools.

import fs from 'fs/promises';
import path from 'path';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { createFileToolGuard } from '../agents/file-tool-guard';
import type { EffortLevel } from '../../../engine/types';
import type { CompositionConfig } from '../composition-config-parser';
import { buildBuilderSystemPrompt, BUDGET_ROUNDS, MIN_ROUNDS, type BuildBudget } from './builder-prompt';
import {
  buildBuilderToolServer,
  builderToolName,
  BUILDER_MCP_SERVER_NAME,
  BUILDER_TOOL_IDS,
  type BuilderState,
} from './builder-tools';

const FILE_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'];
/** SDK turns per budget: generous — the look budget is the real limit. */
const MAX_TURNS: Record<BuildBudget, number> = { quick: 40, standard: 90, craft: 200 };
const MAX_MINUTES: Record<BuildBudget, number> = { quick: 15, standard: 30, craft: 60 };

export interface BuildRequest {
  /** What and why — never pixel boxes. */
  intent: string;
  /** Format line, e.g. "4:5, 1080x1350, 30 fps, 240 frames (8 s), seamless loop". */
  format: string;
  outDir: string;
  budget: BuildBudget;
  packs: Array<{ name: string; body: string }>;
  providerId?: string;
  model?: string;
  effort?: EffortLevel;
  maxMinutes?: number;
  signal?: AbortSignal;
}

export interface BuildResult {
  ok: boolean;
  /** True when the builder called `finish`; false = capped, fell back to the last good check. */
  finished: boolean;
  code?: string;
  config?: CompositionConfig;
  summary?: string;
  rounds: number;
  checks: number;
  elapsedMs: number;
  usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; costUsd?: number };
  finalText?: string;
  error?: string;
}

function firstMessage(req: BuildRequest): string {
  return [
    `Build this as an animated composition.`,
    ``,
    `IDEA: ${req.intent}`,
    `FORMAT: ${req.format}`,
    ``,
    `Your folder is empty. Start with DESIGN.md, then build, check, and look.`,
  ].join('\n');
}

export async function buildComposition(req: BuildRequest): Promise<BuildResult> {
  const started = Date.now();
  const workDir = path.join(req.outDir, 'work');
  await fs.mkdir(workDir, { recursive: true });

  const state: BuilderState = {
    workDir,
    outDir: req.outDir,
    roundsMax: BUDGET_ROUNDS[req.budget],
    roundsMin: MIN_ROUNDS[req.budget],
    roundsUsed: 0,
    checks: 0,
    lastGood: null,
    finished: null,
  };

  const systemPrompt = buildBuilderSystemPrompt({ budget: req.budget, packs: req.packs });
  await fs.writeFile(path.join(req.outDir, 'system-prompt.md'), systemPrompt, 'utf-8');

  // Wall-clock cap, joined with the caller's signal.
  const abort = new AbortController();
  const capMs = (req.maxMinutes ?? MAX_MINUTES[req.budget]) * 60_000;
  const timer = setTimeout(() => abort.abort(), capMs);
  req.signal?.addEventListener('abort', () => abort.abort(), { once: true });

  // One write at a time: concurrent appends land out of order.
  const transcript = path.join(req.outDir, 'transcript.txt');
  let writes = Promise.resolve();
  const onTextDelta = (delta: string) => {
    writes = writes.then(() => fs.appendFile(transcript, delta, 'utf-8')).catch(() => {});
  };

  let response: Awaited<ReturnType<typeof runLlmGenerate>>;
  try {
    response = await runLlmGenerate(
      {
        prompt: firstMessage(req),
        systemPrompt,
        featureSource: 'tsx-generation',
        maxTurns: MAX_TURNS[req.budget],
        thinking: { type: 'adaptive' },
        effort: req.effort ?? 'medium',
        agentTools: FILE_TOOLS,
        allowedTools: BUILDER_TOOL_IDS.map(builderToolName),
        ...(req.providerId ? { providerId: req.providerId } : {}),
        ...(req.model ? { model: req.model } : {}),
      },
      abort.signal,
      onTextDelta,
      {
        mcpServers: { [BUILDER_MCP_SERVER_NAME]: buildBuilderToolServer(state) },
        cwd: workDir,
        canUseTool: createFileToolGuard(workDir),
      },
    );
  } finally {
    clearTimeout(timer);
    await writes;
  }

  const result = state.finished ?? (state.lastGood ? { ...state.lastGood, summary: undefined } : null);
  return {
    ok: result !== null,
    finished: state.finished !== null,
    ...(result ? { code: result.code, config: result.config } : {}),
    ...(state.finished ? { summary: state.finished.summary } : {}),
    rounds: state.roundsUsed,
    checks: state.checks,
    elapsedMs: Date.now() - started,
    ...(response.usage ? { usage: response.usage } : {}),
    ...(response.text ? { finalText: response.text } : {}),
    ...(response.success ? {} : { error: abort.signal.aborted ? `Stopped at the ${capMs / 60_000}-minute cap or by cancel: ${response.error ?? ''}` : response.error }),
  };
}
