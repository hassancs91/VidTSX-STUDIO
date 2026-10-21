// The builder's own tools (TSX_BUILDER_DESIGN.md T2), as an in-process MCP
// server: `check` and `finish` here, the five that render: three picture
// looks (`render_stills`, `contact_sheet`, `phone_view`) in
// builder-look-tools.ts and three measures (`loop_seam`, `purity_check`,
// `number_check`) in builder-measure-tools.ts; the three that bring files into
// assets/ (`library_search`, `library_use`, `generate_image`) in
// builder-asset-tools.ts, the shared state and helpers in builder-tool-common.ts.
// File work goes through the SDK's Read/Write/Edit/Glob/Grep behind the path
// guard; these eleven are the only other things the builder can do. Every call
// is appended to the run's events.jsonl so a run can be followed live and
// audited after.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { buildLookTools } from './builder-look-tools';
import { buildMeasureTools } from './builder-measure-tools';
import { buildAssetTools } from './builder-asset-tools';
import {
  buildHash,
  describeCheck,
  isPhysicsBuild,
  logEvent,
  lookedAt,
  numbersOkFor,
  pureOkFor,
  runCheck,
  seamOkFor,
  STOPPING,
  text,
  tracked,
  VERIFY_LOOK_ALLOWANCE,
  type BuilderState,
} from './builder-tool-common';

export type { BuilderState } from './builder-tool-common';
export { VERIFY_LOOK_ALLOWANCE } from './builder-tool-common';

export const BUILDER_MCP_SERVER_NAME = 'builder';
export const BUILDER_TOOL_IDS = [
  'check',
  'render_stills',
  'contact_sheet',
  'phone_view',
  'loop_seam',
  'purity_check',
  'number_check',
  'library_search',
  'library_use',
  'generate_image',
  'finish',
] as const;

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
 * A physics piece whose purity_check still says IMPURE after this many
 * different builds may finish anyway, marked `pureOk: false` (like the seam).
 * P2 part 3's probes: pure sources measured exactly 0, impure ones 3.7-6.1, so
 * a fixed piece lands far from the line.
 */
export const PURITY_IMPURE_ALLOWANCE = 3;

/**
 * A piece whose number_check still says SPLIT after this many different builds
 * may finish anyway, marked `numbersOk: false` (like the seam): the check
 * reads text, and a stubborn false alarm must not burn the run to its cap.
 */
export const NUMBER_SPLIT_ALLOWANCE = 3;

type GateTool = 'look' | 'phone_view' | 'loop_seam' | 'purity_check' | 'number_check';

/**
 * What `finish` still needs before it accepts `code`, checked after the round
 * floor (P1 part 4b): a prompt-only "before you finish" was skipped by the
 * part 4 smoke, a refusal is not. The looks are free, so edits pay them too.
 * A piece that inlines a physics engine must also measure PURE (P2 part 3).
 * The build itself must have been looked at (P3 D1), until the extra looks
 * at a changed build run out.
 */
function finishGate(state: BuilderState, code: string, physics: boolean): Array<{ tool: GateTool; line: string }> {
  const missing: Array<{ tool: GateTool; line: string }> = [];
  if (!lookedAt(state, code) && state.verifyLooks < VERIFY_LOOK_ALLOWANCE) {
    missing.push({
      tool: 'look',
      line: 'the code changed after your last look, so nobody has seen this build: render_stills (or contact_sheet) on it first, frames where the change shows. If the look budget is spent, a look at a changed build is still allowed.',
    });
  }
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
  if (physics && !pureOkFor(state, code) && state.impureBuilds.size < PURITY_IMPURE_ALLOWANCE) {
    const purity = state.lastPurity;
    const line = !purity
      ? 'purity_check has not run yet: this piece simulates physics, so measure that its frames render the same in order and alone.'
      : purity.code !== code
        ? 'purity_check last measured an earlier build (the code changed since): measure this one.'
        : 'purity_check says IMPURE on this build: step the simulation through useSimulation from @vidtsx/sim, then measure again.';
    missing.push({ tool: 'purity_check', line });
  }
  // P4-12: the one-clock rule as a refusal. Only where a look showed numbers that move.
  if (state.numbersMove && !numbersOkFor(state, code) && state.numberSplitBuilds.size < NUMBER_SPLIT_ALLOWANCE) {
    const numbers = state.lastNumbers;
    const line = !numbers
      ? 'number_check has not run yet: your looks show numbers that change, so check every frame\'s numbers against the step labels beside them.'
      : numbers.code !== code
        ? 'number_check last swept an earlier build (the code changed since): sweep this one.'
        : 'number_check says SPLIT on this build: draw every number beside a step label from that one integer step, then check again.';
    missing.push({ tool: 'number_check', line });
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
    'End the build. Runs a final check; on success the current build becomes the result. Refused until you have LOOKED at this exact build (render_stills or contact_sheet after your last change; allowed even when the look budget is spent) and phone_view has run once; on a loop, until the last loop_seam measured this exact build and said OK; on a piece that uses a physics engine, until the last purity_check measured this exact build and said PURE; when your looks showed numbers that change, until the last number_check swept this exact build and said OK — so run those after your last change. Give a short summary: the picture chosen, what each round changed, the numbers verified, anything in the request you corrected.',
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
      const physics = isPhysicsBuild(result.inlinedPackages);
      const missing = finishGate(state, result.code, physics);
      if (missing.length > 0) {
        await logEvent(state, { tool: 'finish', refused: true, missing: missing.map((m) => m.tool), build: buildHash(result.code) });
        const look = missing.find((m) => m.tool === 'look');
        const free = missing.filter((m) => m.tool !== 'look');
        const parts = [
          ...(look ? [look.line] : []),
          ...(free.length > 0
            ? [`finish needs ${free.length === 1 ? 'this free check' : 'these free checks'} first (no look round):\n- ${free.map((m) => m.line).join('\n- ')}`]
            : []),
        ];
        return text(`Not yet: ${parts.join('\nAnd ')}`, true);
      }
      const seamOk = state.expect.loop ? seamOkFor(state, result.code) : undefined;
      const pureOk = physics ? pureOkFor(state, result.code) : undefined;
      const numbersOk = state.numbersMove ? numbersOkFor(state, result.code) : undefined;
      const looked = lookedAt(state, result.code);
      state.finished = { summary: args.summary, code: result.code, config: result.config, physics };
      await logEvent(state, {
        tool: 'finish',
        rounds: state.roundsUsed,
        checks: state.checks,
        phoneViews: state.phoneViews,
        seamChecks: state.seamChecks,
        build: buildHash(result.code),
        looked,
        ...(state.verifyLooks > 0 ? { verifyLooks: state.verifyLooks } : {}),
        ...(seamOk === undefined ? {} : { seamOk, seamJumps: state.seamJumps.size }),
        ...(pureOk === undefined ? {} : { pureOk, purityChecks: state.purityChecks, impureBuilds: state.impureBuilds.size }),
        ...(numbersOk === undefined ? {} : { numbersOk, numberChecks: state.numberChecks, splitBuilds: state.numberSplitBuilds.size }),
      });
      const unverified = [
        ...(looked ? [] : [`the final build NOT looked at: the ${VERIFY_LOOK_ALLOWANCE} extra looks at a changed build were used`]),
        ...(seamOk === false
          ? [`the loop seam NOT verified: loop_seam called ${state.seamJumps.size} builds a JUMP, so the result is marked seamOk: false`]
          : []),
        ...(pureOk === false
          ? [`frame purity NOT verified: purity_check called ${state.impureBuilds.size} builds IMPURE, so the result is marked pureOk: false`]
          : []),
        ...(numbersOk === false
          ? [`the numbers NOT verified: number_check called ${state.numberSplitBuilds.size} builds SPLIT, so the result is marked numbersOk: false`]
          : []),
      ];
      if (unverified.length > 0) {
        return text(`Finished after the allowed tries, with ${unverified.join('; and ')}. Say so in one short line and stop.`);
      }
      return text('Finished. The build will be saved. Reply with one short line and stop.');
    }),
  );

  return createSdkMcpServer({
    name: BUILDER_MCP_SERVER_NAME,
    tools: [check, ...buildLookTools(state), ...buildMeasureTools(state), ...buildAssetTools(state), finish],
  });
}
