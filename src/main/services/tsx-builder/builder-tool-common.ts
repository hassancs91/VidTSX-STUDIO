// What the builder's two tool files share (TSX_BUILDER_DESIGN.md T2):
// builder-tools.ts holds the registry, `check` and `finish`;
// builder-look-tools.ts the four that render. The run state, the result
// helpers, the event log and the check every tool starts with live here.
//
// Stopping (cancel or a cap) aborts `state.signal`: a render in flight is
// cancelled, a call that arrives after it is refused, and nothing is
// committed after it — a `finish` racing a cancel does not count.

import fs from 'fs/promises';
import path from 'path';
import { checkBuild, type BuildCheckResult } from './build-check';
import type { CompositionConfig } from '../composition-config-parser';
import type { BuildStillShown, RunDirs } from './build-store';
import type { BuildFormat, BuildPhase, BuildProgressDetail } from './types';

export interface BuilderState {
  dirs: RunDirs;
  /** The requested frame; `check` fails a config that departs from it. */
  expect: BuildFormat;
  roundsMax: number;
  /** finish is refused before this many rounds (unless the budget is spent). */
  roundsMin: number;
  /** Look rounds: render_stills and contact_sheet calls. */
  roundsUsed: number;
  checks: number;
  /** phone_view calls (free, capped per run). */
  phoneViews: number;
  /** loop_seam calls (free). */
  seamChecks: number;
  /** The last artifact that passed every gate — what a capped run returns. */
  lastGood: { code: string; config: CompositionConfig; check: number } | null;
  finished: { summary: string; code: string; config: CompositionConfig } | null;
  /** Every image shown to the builder, in order — saved with the version. */
  stills: BuildStillShown[];
  /** Aborted when the run stops (cancel or a cap). */
  signal?: AbortSignal;
  /** Tool calls in flight: the run awaits them before it saves. */
  inFlight: Set<Promise<unknown>>;
  /** Progress out (tsx-builder.ts wires these to BuildProgress). */
  onEvent?: (detail: BuildProgressDetail) => void;
  onPhase?: (phase: BuildPhase) => void;
}

export type ToolContent = Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
export type ToolResult = { content: ToolContent; isError?: boolean };

export const text = (t: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(isError ? { isError: true } : {}),
});

export const STOPPING = 'The run is stopping. Reply with one short line and stop.';

export async function logEvent(state: BuilderState, event: Record<string, unknown>): Promise<void> {
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  await fs.appendFile(path.join(state.dirs.runDir, 'events.jsonl'), `${line}\n`, 'utf-8').catch(() => {});
}

/** One tool call: refused once stopped, tracked while in flight, its phase shown while it runs. */
export function tracked<A>(state: BuilderState, phase: BuildPhase, handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    if (state.signal?.aborted) return text(STOPPING, true);
    state.onPhase?.(phase);
    const run = handler(args);
    state.inFlight.add(run);
    try {
      return await run;
    } finally {
      state.inFlight.delete(run);
      if (state.inFlight.size === 0 && !state.signal?.aborted) state.onPhase?.('working');
    }
  };
}

export async function runCheck(state: BuilderState): Promise<BuildCheckResult> {
  state.checks += 1;
  const result = await checkBuild(state.dirs.workDir, state.expect);
  if (result.ok && result.code && result.config) {
    state.lastGood = { code: result.code, config: result.config, check: state.checks };
    const dir = path.join(state.dirs.runDir, 'checkpoints');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `c${String(state.checks).padStart(2, '0')}.tsx`), result.code, 'utf-8');
  }
  await logEvent(state, {
    tool: 'check',
    n: state.checks,
    ok: result.ok,
    ms: result.ms,
    errors: result.errors,
    files: result.inlinedFiles,
    packages: result.inlinedPackages,
  });
  state.onEvent?.({ type: 'check', n: state.checks, ok: result.ok, errors: result.errors });
  return result;
}

export function describeCheck(result: BuildCheckResult): string {
  if (!result.ok) return `check FAILED:\n- ${result.errors.join('\n- ')}`;
  const c = result.config!;
  return `check passed: ${result.inlinedFiles.length + 1} file(s) bundled (${result.code!.length} bytes), packages: ${result.inlinedPackages.join(', ') || 'none'}; ${c.width}x${c.height}, ${c.fps} fps, ${c.durationInFrames} frames (${(c.durationInFrames / c.fps).toFixed(2)} s).`;
}

export type CheckedBuild = { code: string; config: CompositionConfig; summary: string };

/** The check every look starts with: the build to render, or the reply that ends the call. */
export async function checkForLook(state: BuilderState): Promise<{ build: CheckedBuild } | { reply: ToolResult }> {
  const result = await runCheck(state);
  if (!result.ok || !result.code || !result.config) return { reply: text(describeCheck(result), true) };
  if (state.signal?.aborted) return { reply: text(STOPPING, true) };
  return { build: { code: result.code, config: result.config, summary: describeCheck(result) } };
}
