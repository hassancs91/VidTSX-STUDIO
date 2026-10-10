// The builder's own tools (TSX_BUILDER_DESIGN.md T2), as an in-process MCP
// server: `check`, `render_stills`, `finish`. File work goes through the SDK's
// Read/Write/Edit/Glob/Grep behind the path guard; these three are the only
// other things the builder can do. Every call is appended to events.jsonl so a
// run can be followed live and audited after.

import fs from 'fs/promises';
import path from 'path';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { checkBuild, type BuildCheckResult } from './build-check';
import { renderBuildStills } from './build-stills';
import type { CompositionConfig } from '../composition-config-parser';

export const BUILDER_MCP_SERVER_NAME = 'builder';
export const BUILDER_TOOL_IDS = ['check', 'render_stills', 'finish'] as const;

export function builderToolName(id: (typeof BUILDER_TOOL_IDS)[number]): string {
  return `mcp__${BUILDER_MCP_SERVER_NAME}__${id}`;
}

export interface BuilderState {
  workDir: string;
  outDir: string;
  roundsMax: number;
  /** finish is refused before this many rounds (unless the budget is spent). */
  roundsMin: number;
  roundsUsed: number;
  checks: number;
  /** The last artifact that passed every gate — what a capped run returns. */
  lastGood: { code: string; config: CompositionConfig; check: number } | null;
  finished: { summary: string; code: string; config: CompositionConfig } | null;
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
  await fs.appendFile(path.join(state.outDir, 'events.jsonl'), `${line}\n`, 'utf-8').catch(() => {});
}

async function runCheck(state: BuilderState): Promise<BuildCheckResult> {
  state.checks += 1;
  const result = await checkBuild(state.workDir);
  if (result.ok && result.code && result.config) {
    state.lastGood = { code: result.code, config: result.config, check: state.checks };
    const dir = path.join(state.outDir, 'checkpoints');
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
    'Bundle your folder (entry index.tsx) into the single file the app ships and run every gate: transpile, imports, default export, literal compositionConfig. Returns errors verbatim. Free — use it as often as you like.',
    {},
    async () => {
      const result = await runCheck(state);
      return text(describeCheck(result), !result.ok);
    },
  );

  const renderStills = tool(
    'render_stills',
    'Check, then render frames of the current build and SHOW them to you. One call = one look round (budgeted). size "model" (default) is ~1024 px; "phone" is half size, for the legibility test. Pick frames across the whole duration.',
    {
      frames: z.array(z.number().int()).min(1).max(12).describe('Frame numbers to render (0-based), at most 12'),
      size: z.enum(['model', 'phone']).optional().describe('"phone" renders at half size for the legibility check'),
    },
    async (args) => {
      if (state.roundsUsed >= state.roundsMax) {
        return text(`The look budget is spent (${state.roundsMax}/${state.roundsMax}). Make any last fix with check, then call finish.`, true);
      }
      const result = await runCheck(state);
      if (!result.ok || !result.code || !result.config) return text(describeCheck(result), true);

      state.roundsUsed += 1;
      const round = `r${String(state.roundsUsed).padStart(2, '0')}${args.size === 'phone' ? '-phone' : ''}`;
      const longest = Math.max(result.config.width, result.config.height);
      const maxSide = args.size === 'phone' ? Math.round(longest / 2) : 1024;
      const started = Date.now();
      try {
        const stills = await renderBuildStills(result.code, result.config, path.join(state.outDir, 'stills'), args.frames, {
          maxSide,
          label: round,
        });
        await logEvent(state, {
          tool: 'render_stills',
          round: state.roundsUsed,
          size: args.size ?? 'model',
          frames: stills.stills.map((s) => s.frame),
          ms: stills.ms,
          bundleCached: stills.bundleCached,
          totalMs: Date.now() - started,
        });
        const content: ToolResult['content'] = [
          { type: 'text', text: `${describeCheck(result)}\nRendered frames ${stills.stills.map((s) => s.frame).join(', ')} (${args.size ?? 'model'} size), in order below. ${roundsLine()}` },
        ];
        for (const still of stills.stills) {
          content.push({ type: 'text', text: `Frame ${still.frame}:` });
          content.push({ type: 'image', data: still.data, mimeType: still.mimeType });
        }
        return { content };
      } catch (err) {
        // A render failure is the build's fault (a runtime error), not the budget's.
        state.roundsUsed -= 1;
        const message = err instanceof Error ? err.message : String(err);
        await logEvent(state, { tool: 'render_stills', error: message });
        return text(`Rendering failed — this is a runtime error in your code:\n${message}`, true);
      }
    },
  );

  const finish = tool(
    'finish',
    'End the build. Runs a final check; on success the current build becomes the result. Give a short summary: the picture chosen, what each round changed, the numbers verified, anything in the request you corrected.',
    { summary: z.string().min(1).describe('What you built and why, round by round') },
    async (args) => {
      if (state.roundsUsed < state.roundsMin && state.roundsUsed < state.roundsMax) {
        await logEvent(state, { tool: 'finish', refused: true, rounds: state.roundsUsed });
        return text(
          `Not yet: this budget needs at least ${state.roundsMin} look rounds before finishing (${state.roundsUsed} used). Push the DESIGN, not only the bugs: what would make the picture more alive, more specific to this idea, the payoff more felt? Change it, then look again.`,
          true,
        );
      }
      const result = await runCheck(state);
      if (!result.ok || !result.code || !result.config) {
        return text(`Cannot finish: ${describeCheck(result)}`, true);
      }
      state.finished = { summary: args.summary, code: result.code, config: result.config };
      await fs.writeFile(path.join(state.outDir, 'final.tsx'), result.code, 'utf-8');
      await fs.rm(path.join(state.outDir, 'final.src'), { recursive: true, force: true });
      await fs.cp(state.workDir, path.join(state.outDir, 'final.src'), { recursive: true });
      await fs.writeFile(path.join(state.outDir, 'summary.md'), args.summary, 'utf-8');
      await logEvent(state, { tool: 'finish', rounds: state.roundsUsed, checks: state.checks });
      return text('Finished. The build is saved. Reply with one short line and stop.');
    },
  );

  return createSdkMcpServer({ name: BUILDER_MCP_SERVER_NAME, tools: [check, renderStills, finish] });
}
