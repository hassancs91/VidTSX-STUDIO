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
import { describeCheck, logEvent, runCheck, STOPPING, text, tracked, type BuilderState } from './builder-tool-common';

export type { BuilderState } from './builder-tool-common';

export const BUILDER_MCP_SERVER_NAME = 'builder';
export const BUILDER_TOOL_IDS = ['check', 'render_stills', 'contact_sheet', 'phone_view', 'loop_seam', 'finish'] as const;

export function builderToolName(id: (typeof BUILDER_TOOL_IDS)[number]): string {
  return `mcp__${BUILDER_MCP_SERVER_NAME}__${id}`;
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
      await logEvent(state, {
        tool: 'finish',
        rounds: state.roundsUsed,
        checks: state.checks,
        phoneViews: state.phoneViews,
        seamChecks: state.seamChecks,
      });
      return text('Finished. The build will be saved. Reply with one short line and stop.');
    }),
  );

  return createSdkMcpServer({
    name: BUILDER_MCP_SERVER_NAME,
    tools: [check, ...buildLookTools(state), finish],
  });
}
