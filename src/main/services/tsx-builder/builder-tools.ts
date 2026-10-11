// The builder's own tools (TSX_BUILDER_DESIGN.md T2), as an in-process MCP
// server: `check` and `finish` here, the four that render (`render_stills`,
// `contact_sheet`, `phone_view`, `loop_seam`) in builder-look-tools.ts, the
// shared state and helpers in builder-tool-common.ts. File work goes through
// the SDK's Read/Write/Edit/Glob/Grep behind the path guard; these six are the
// only other things the builder can do. Every call is appended to the run's
// events.jsonl so a run can be followed live and audited after.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { buildLookTools } from './builder-look-tools';
import {
  buildHash,
  describeCheck,
  logEvent,
  runCheck,
  seamOkFor,
  STOPPING,
  text,
  tracked,
  type BuilderState,
} from './builder-tool-common';

export type { BuilderState } from './builder-tool-common';

export const BUILDER_MCP_SERVER_NAME = 'builder';
export const BUILDER_TOOL_IDS = ['check', 'render_stills', 'contact_sheet', 'phone_view', 'loop_seam', 'finish'] as const;

export function builderToolName(id: (typeof BUILDER_TOOL_IDS)[number]): string {
  return `mcp__${BUILDER_MCP_SERVER_NAME}__${id}`;
}

/**
 * A loop whose seam still says JUMP after this many different builds may
 * finish anyway, marked `seamOk: false`: a stubborn seam must not burn the run
 * to its cap. Three = a first fix and two more tries; P1's seamless loops
 * measured 0-1.51× against the 2.5× threshold, so a fixed seam lands well under it.
 */
export const SEAM_JUMP_ALLOWANCE = 3;

/**
 * What `finish` still needs before it accepts `code`, checked after the round
 * floor (P1 part 4b): a prompt-only "before you finish" was skipped by the
 * part 4 smoke, a refusal is not. Both looks are free, so edits pay them too.
 */
function finishGate(state: BuilderState, code: string): Array<{ tool: 'phone_view' | 'loop_seam'; line: string }> {
  const missing: Array<{ tool: 'phone_view' | 'loop_seam'; line: string }> = [];
  if (state.phoneViews === 0) {
    missing.push({ tool: 'phone_view', line: 'phone_view has not run yet: call it on the frame with the smallest text.' });
  }
  if (state.expect.loop && !seamOkFor(state, code) && state.seamJumps.size < SEAM_JUMP_ALLOWANCE) {
    const seam = state.lastSeam;
    const line = !seam
      ? 'loop_seam has not run yet: measure the seam of this build.'
      : seam.code !== code
        ? 'loop_seam last measured an earlier build (the code changed since): measure this one.'
        : 'loop_seam says JUMP on this build: make the last frame flow into frame 0, then measure again.';
    missing.push({ tool: 'loop_seam', line });
  }
  return missing;
}

export function buildBuilderToolServer(state: BuilderState) {
  const check = tool(
    'check',
    'Bundle your folder (entry index.tsx) into the single file the app ships and run every gate: transpile, imports, default export, literal compositionConfig matching the requested format. Returns errors verbatim. Free — use it as often as you like.',
    {},
    tracked(state, 'checking', async () => {
      const result = await runCheck(state);
      return text(describeCheck(result), !result.ok);
    }),
  );

  const finish = tool(
    'finish',
    'End the build. Runs a final check; on success the current build becomes the result. Refused until phone_view has run once and, on a loop, the last loop_seam measured this exact build and said OK — so measure the seam after your last change. Give a short summary: the picture chosen, what each round changed, the numbers verified, anything in the request you corrected.',
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
      const missing = finishGate(state, result.code);
      if (missing.length > 0) {
        await logEvent(state, { tool: 'finish', refused: true, missing: missing.map((m) => m.tool), build: buildHash(result.code) });
        return text(
          `Not yet: finish needs ${missing.length === 1 ? 'this free check' : 'these free checks'} first (no look round):\n- ${missing.map((m) => m.line).join('\n- ')}`,
          true,
        );
      }
      const seamOk = state.expect.loop ? seamOkFor(state, result.code) : undefined;
      state.finished = { summary: args.summary, code: result.code, config: result.config };
      await logEvent(state, {
        tool: 'finish',
        rounds: state.roundsUsed,
        checks: state.checks,
        phoneViews: state.phoneViews,
        seamChecks: state.seamChecks,
        build: buildHash(result.code),
        ...(seamOk === undefined ? {} : { seamOk, seamJumps: state.seamJumps.size }),
      });
      if (seamOk === false) {
        return text(
          `Finished, with the loop seam NOT verified: loop_seam called ${state.seamJumps.size} builds a JUMP, so finish let this one through and the result is marked seamOk: false. Say so in one short line and stop.`,
        );
      }
      return text('Finished. The build will be saved. Reply with one short line and stop.');
    }),
  );

  return createSdkMcpServer({
    name: BUILDER_MCP_SERVER_NAME,
    tools: [check, ...buildLookTools(state), finish],
  });
}
