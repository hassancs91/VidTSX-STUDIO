// The builder's own tools (TSX_BUILDER_DESIGN.md T2), as an in-process MCP
// server: `check`, `render_stills`, `finish`. File work goes through the SDK's
// Read/Write/Edit/Glob/Grep behind the path guard; these three are the only
// other things the builder can do. Every call is appended to the run's
// events.jsonl so a run can be followed live and audited after.
//
// Stopping (cancel or a cap) aborts `state.signal`: a render in flight is
// cancelled, a call that arrives after it is refused, and nothing is
// committed after it — a `finish` racing a cancel does not count.

import fs from 'fs/promises';
import path from 'path';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { checkBuild, type BuildCheckResult } from './build-check';
import { renderBuildStills } from './build-stills';
import type { CompositionConfig } from '../composition-config-parser';
import type { RunDirs } from './build-store';
import type { BuildFormat, BuildPhase, BuildProgressDetail } from './types';

export const BUILDER_MCP_SERVER_NAME = 'builder';
export const BUILDER_TOOL_IDS = ['check', 'render_stills', 'finish'] as const;

export function builderToolName(id: (typeof BUILDER_TOOL_IDS)[number]): string {
  return `mcp__${BUILDER_MCP_SERVER_NAME}__${id}`;
}

export interface BuilderState {
  dirs: RunDirs;
  /** The requested frame; `check` fails a config that departs from it. */
  expect: BuildFormat;
  roundsMax: number;
  /** finish is refused before this many rounds (unless the budget is spent). */
  roundsMin: number;
  roundsUsed: number;
  checks: number;
  /** The last artifact that passed every gate — what a capped run returns. */
  lastGood: { code: string; config: CompositionConfig; check: number } | null;
  finished: { summary: string; code: string; config: CompositionConfig } | null;
  /** Every frame shown to the builder, in order — saved with the version. */
  stills: Array<{ round: number; frame: number; size: 'model' | 'phone'; path: string }>;
  /** Aborted when the run stops (cancel or a cap). */
  signal?: AbortSignal;
  /** Tool calls in flight: the run awaits them before it saves. */
  inFlight: Set<Promise<unknown>>;
  /** Progress out (tsx-builder.ts wires these to BuildProgress). */
  onEvent?: (detail: BuildProgressDetail) => void;
  onPhase?: (phase: BuildPhase) => void;
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
};

const text = (t: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(isError ? { isError: true } : {}),
});

async function logEvent(state: BuilderState, event: Record<string, unknown>): Promise<void> {
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  await fs.appendFile(path.join(state.dirs.runDir, 'events.jsonl'), `${line}\n`, 'utf-8').catch(() => {});
}

const STOPPING = 'The run is stopping. Reply with one short line and stop.';

/** One tool call: refused once stopped, tracked while in flight, its phase shown while it runs. */
function tracked<A>(state: BuilderState, phase: BuildPhase, handler: (args: A) => Promise<ToolResult>) {
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

async function runCheck(state: BuilderState): Promise<BuildCheckResult> {
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

function describeCheck(result: BuildCheckResult): string {
  if (!result.ok) return `check FAILED:\n- ${result.errors.join('\n- ')}`;
  const c = result.config!;
  return `check passed: ${result.inlinedFiles.length + 1} file(s) bundled (${result.code!.length} bytes), packages: ${result.inlinedPackages.join(', ') || 'none'}; ${c.width}x${c.height}, ${c.fps} fps, ${c.durationInFrames} frames (${(c.durationInFrames / c.fps).toFixed(2)} s).`;
}

export function buildBuilderToolServer(state: BuilderState) {
  const roundsLine = () => `Look rounds used: ${state.roundsUsed}/${state.roundsMax}.`;

  const check = tool(
    'check',
    'Bundle your folder (entry index.tsx) into the single file the app ships and run every gate: transpile, imports, default export, literal compositionConfig matching the requested format. Returns errors verbatim. Free — use it as often as you like.',
    {},
    tracked(state, 'checking', async () => {
      const result = await runCheck(state);
      return text(describeCheck(result), !result.ok);
    }),
  );

  const renderStills = tool(
    'render_stills',
    'Check, then render frames of the current build and SHOW them to you. One call = one look round (budgeted). size "model" (default) is ~1024 px; "phone" is half size, for the legibility test. Pick frames across the whole duration.',
    {
      frames: z.array(z.number().int()).min(1).max(12).describe('Frame numbers to render (0-based), at most 12'),
      size: z.enum(['model', 'phone']).optional().describe('"phone" renders at half size for the legibility check'),
    },
    tracked(state, 'rendering', async (args: { frames: number[]; size?: 'model' | 'phone' }) => {
      if (state.roundsUsed >= state.roundsMax) {
        return text(`The look budget is spent (${state.roundsMax}/${state.roundsMax}). Make any last fix with check, then call finish.`, true);
      }
      const result = await runCheck(state);
      if (!result.ok || !result.code || !result.config) return text(describeCheck(result), true);
      if (state.signal?.aborted) return text(STOPPING, true);

      state.roundsUsed += 1;
      const size = args.size ?? 'model';
      const label = `r${String(state.roundsUsed).padStart(2, '0')}${size === 'phone' ? '-phone' : ''}`;
      const longest = Math.max(result.config.width, result.config.height);
      const maxSide = size === 'phone' ? Math.round(longest / 2) : 1024;
      const started = Date.now();
      try {
        const stills = await renderBuildStills(result.code, result.config, state.dirs.stillsDir, args.frames, {
          maxSide,
          label,
          ...(state.signal ? { signal: state.signal } : {}),
        });
        for (const still of stills.stills) {
          state.stills.push({ round: state.roundsUsed, frame: still.frame, size, path: still.path });
        }
        await logEvent(state, {
          tool: 'render_stills',
          round: state.roundsUsed,
          size,
          frames: stills.stills.map((s) => s.frame),
          ms: stills.ms,
          bundleCached: stills.bundleCached,
          totalMs: Date.now() - started,
        });
        state.onEvent?.({
          type: 'stills',
          size,
          frames: stills.stills.map((s) => s.frame),
          paths: stills.stills.map((s) => s.path),
        });
        const content: ToolResult['content'] = [
          { type: 'text', text: `${describeCheck(result)}\nRendered frames ${stills.stills.map((s) => s.frame).join(', ')} (${size} size), in order below. ${roundsLine()}` },
        ];
        for (const still of stills.stills) {
          content.push({ type: 'text', text: `Frame ${still.frame}:` });
          content.push({ type: 'image', data: still.data, mimeType: still.mimeType });
        }
        return { content };
      } catch (err) {
        // A render failure is the build's fault (a runtime error), not the budget's.
        state.roundsUsed -= 1;
        if (state.signal?.aborted) {
          await logEvent(state, { tool: 'render_stills', cancelled: true, totalMs: Date.now() - started });
          return text(STOPPING, true);
        }
        const message = err instanceof Error ? err.message : String(err);
        await logEvent(state, { tool: 'render_stills', error: message });
        return text(`Rendering failed — this is a runtime error in your code:\n${message}`, true);
      }
    }),
  );

  const finish = tool(
    'finish',
    'End the build. Runs a final check; on success the current build becomes the result. Give a short summary: the picture chosen, what each round changed, the numbers verified, anything in the request you corrected.',
    { summary: z.string().min(1).describe('What you built and why, round by round') },
    tracked(state, 'checking', async (args: { summary: string }) => {
      if (state.finished) return text('Already finished. Reply with one short line and stop.');
      if (state.roundsUsed < state.roundsMin && state.roundsUsed < state.roundsMax) {
        await logEvent(state, { tool: 'finish', refused: true, rounds: state.roundsUsed });
        if (state.roundsUsed === 0) {
          return text('Not yet: look at the build first (render_stills), then finish.', true);
        }
        return text(
          `Not yet: this budget needs at least ${state.roundsMin} look rounds before finishing (${state.roundsUsed} used). Push the DESIGN, not only the bugs: what would make the picture more alive, more specific to this idea, the payoff more felt? Change it, then look again.`,
          true,
        );
      }
      const result = await runCheck(state);
      if (!result.ok || !result.code || !result.config) {
        return text(`Cannot finish: ${describeCheck(result)}`, true);
      }
      if (state.signal?.aborted) return text(STOPPING, true);
      state.finished = { summary: args.summary, code: result.code, config: result.config };
      await logEvent(state, { tool: 'finish', rounds: state.roundsUsed, checks: state.checks });
      return text('Finished. The build will be saved. Reply with one short line and stop.');
    }),
  );

  return createSdkMcpServer({ name: BUILDER_MCP_SERVER_NAME, tools: [check, renderStills, finish] });
}
