// Claude-powered cut planner via the Agent SDK with Read/Write tools.
//
// Mirrors the original `extract-and-cut` skill's workflow:
//   1. analysis.json is already on disk in the workspace (host wrote it)
//   2. Claude (Opus 4.7, thinking enabled) reads it, reasons, writes
//      timeline.json + cuts.md back to the same workspace
//   3. We parse timeline.json and convert it to a StudioCutPlan
//
// This is intentionally NOT one-shot. The original skill produces good
// results because Claude can scroll through the analysis selectively,
// scaffold reasoning across multiple turns, and the act of writing two
// documents (timeline.json + cuts.md) forces deliberate analysis. We
// preserve that structure.

import { readFile } from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { llmEngine } from '../../../engine';
import { composeSystemPrompt } from '../skills-registry';
import { aiUsageService } from '../ai-usage';
import type {
  StudioCutPlan,
  StudioCutPlanCut,
  StudioCutPlanFlag,
  StudioCutReason,
  StudioCutFlagType,
} from '../../../shared/ipc/types';

const log = logEngine.createLogger('auto-cut/plan-cuts');

export interface PlanCutsOptions {
  workspaceDir: string;
  analysisPath: string;
  sourceDuration: number;
  brand?: string;
  signal?: AbortSignal;
  // Receives short status strings during the agent's run for UI surfacing.
  onThinking?: (message: string) => void;
}

const CUT_TYPES: ReadonlySet<StudioCutReason> = new Set([
  'retake',
  'silence',
  'repeat',
  'manual',
]);

const FLAG_TYPES: ReadonlySet<StudioCutFlagType> = new Set([
  'energy_dip',
  'filler_cluster',
  'hallucination_suspect',
  'long_silence_intentional',
  'heavy_cut_warning',
]);

// Pin Opus + budgeted thinking. Cut judgment is the user's #1 quality lever
// — this is exactly the kind of task that pays for the more capable model.
const PLANNER_MODEL = 'claude-opus-4-7';
const PLANNER_THINKING_BUDGET_TOKENS = 16000;
const PLANNER_MAX_TURNS = 30;

export async function planCuts(opts: PlanCutsOptions): Promise<StudioCutPlan> {
  const systemPrompt = await composeSystemPrompt('', ['extract-and-cut']);

  // The user message tells Claude WHERE to operate. The skill body in the
  // system prompt describes WHAT to do.
  const userPrompt =
    `Run the extract-and-cut skill against the workspace.\n\n` +
    `Workspace: ${opts.workspaceDir}\n\n` +
    `Brand:\n${opts.brand?.trim() || '(none — proceed without brand context)'}\n\n` +
    `Read \`${path.join(opts.workspaceDir, 'analysis.json')}\`, apply the policy, ` +
    `then Write \`${path.join(opts.workspaceDir, 'timeline.json')}\` ` +
    `and \`${path.join(opts.workspaceDir, 'cuts.md')}\`. ` +
    `Reply with a one-paragraph summary at the end.`;

  const start = Date.now();
  const sessionScope = `auto-cut-plan:${start}`;
  opts.onThinking?.('Claude is reading the analysis…');

  let result;
  try {
    result = await llmEngine.generate({
      prompt: userPrompt,
      systemPrompt,
      model: PLANNER_MODEL,
      maxTokens: 8192,
      temperature: 0.3,
      agentTools: ['Read', 'Write'],
      allowedTools: ['Read', 'Write'],
      maxTurns: PLANNER_MAX_TURNS,
      thinking: { type: 'enabled', budgetTokens: PLANNER_THINKING_BUDGET_TOKENS, display: 'summarized' },
      sessionScope,
      signal: opts.signal,
    });
  } catch (err) {
    throw new Error(
      `Cut planner LLM call failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  log.info('Cut planner turn complete', {
    durationMs: Date.now() - start,
    model: result.model,
    turns: result.usage?.numTurns,
  });
  opts.onThinking?.('Loading plan…');

  // Read what Claude wrote.
  const timelinePath = path.join(opts.workspaceDir, 'timeline.json');
  let timelineRaw: string;
  try {
    timelineRaw = await readFile(timelinePath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Claude did not write timeline.json at ${timelinePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let plan: StudioCutPlan;
  try {
    plan = parseAndValidate(timelineRaw, opts.sourceDuration);
  } catch (err) {
    throw new Error(
      `timeline.json from Claude was invalid: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Best-effort usage logging
  aiUsageService.appendEntry({
    timestamp: new Date().toISOString(),
    provider: result.provider || 'unknown',
    model: result.model || PLANNER_MODEL,
    featureSource: 'auto-cut',
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    cacheReadInputTokens: result.usage?.cacheReadInputTokens ?? 0,
    costUsd: result.usage?.costUsd ?? 0,
    durationMs: Date.now() - start,
    requestType: 'llm',
  }).catch(() => {});

  log.info('Cut plan parsed', {
    cuts: plan.cuts.length,
    flags: plan.flags.length,
    removedPercent: plan.stats.removedPercent.toFixed(1),
  });

  return plan;
}

// Parse the timeline.json shape from the skill into a StudioCutPlan. The skill
// writes a fuller structure (cut_timeline + review_flags) — we extract the
// pieces our renderer needs.
function parseAndValidate(raw: string, sourceDuration: number): StudioCutPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('top-level value is not an object');
  }
  const obj = parsed as Record<string, unknown>;

  const cutsArr = Array.isArray(obj.cuts) ? obj.cuts : [];
  const flagsArr = Array.isArray(obj.review_flags)
    ? obj.review_flags
    : Array.isArray(obj.flags)
      ? obj.flags
      : [];

  const cuts: StudioCutPlanCut[] = [];
  for (const c of cutsArr) {
    if (typeof c !== 'object' || c === null) continue;
    const cc = c as Record<string, unknown>;
    const from = Number(cc.from);
    const to = Number(cc.to);
    const type = typeof cc.type === 'string' ? cc.type : 'manual';
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (to <= from) continue;
    cuts.push({
      from: round3(Math.max(0, from)),
      to: round3(Math.min(sourceDuration, to)),
      type: CUT_TYPES.has(type as StudioCutReason) ? (type as StudioCutReason) : 'manual',
      reason: typeof cc.reason === 'string' ? cc.reason : '',
    });
  }

  // Sort ascending and merge overlaps defensively.
  cuts.sort((a, b) => a.from - b.from);
  const merged: StudioCutPlanCut[] = [];
  for (const c of cuts) {
    const last = merged[merged.length - 1];
    if (last && c.from < last.to) {
      last.to = Math.max(last.to, c.to);
      if (c.reason && !last.reason.includes(c.reason)) last.reason += `; ${c.reason}`;
    } else {
      merged.push({ ...c });
    }
  }

  const flags: StudioCutPlanFlag[] = [];
  for (const f of flagsArr) {
    if (typeof f !== 'object' || f === null) continue;
    const ff = f as Record<string, unknown>;
    // The skill writes review_flags with source_start/source_end; tolerate
    // both that and {from, to} for robustness.
    const from = Number(ff.source_start ?? ff.from);
    const to = Number(ff.source_end ?? ff.to);
    const type = typeof ff.type === 'string' ? ff.type : '';
    const note = typeof ff.note === 'string' ? ff.note : '';
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    if (!FLAG_TYPES.has(type as StudioCutFlagType)) continue;
    flags.push({
      from: round3(from),
      to: round3(to),
      type: type as StudioCutFlagType,
      note,
    });
  }

  const removedSeconds = merged.reduce((s, c) => s + (c.to - c.from), 0);
  const cutDuration = Math.max(0, sourceDuration - removedSeconds);
  const removedPercent = sourceDuration > 0 ? (removedSeconds / sourceDuration) * 100 : 0;

  return {
    cuts: merged,
    flags,
    stats: {
      sourceDuration: round3(sourceDuration),
      cutDuration: round3(cutDuration),
      removedPercent: round1(removedPercent),
    },
    generatedAt: Date.now(),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
