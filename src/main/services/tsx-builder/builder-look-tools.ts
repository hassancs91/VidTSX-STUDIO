// The builder's eyes (TSX_BUILDER_DESIGN.md T2): the four tools that render.
// Each checks first and renders the build that passed.
//
// - `render_stills` and `contact_sheet` are LOOK ROUNDS: budgeted, counted
//   toward the `finish` floor, given back when the render fails.
// - `phone_view` (at most MAX_PHONE_VIEWS per run) and `loop_seam` (loops
//   only) are free.
//
// Every image shown is recorded in `state.stills` and saved with the version.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { renderBuildStills } from './build-stills';
import { measureLoopSeam, PHONE_FEED_WIDTH, renderContactSheet, renderPhoneView } from './build-looks';
import { CONTACT_SHEET_MAX_FRAMES, CONTACT_SHEET_MAX_SIDE } from './contact-sheet';
import { describeSeam } from './loop-seam';
import {
  checkForLook,
  logEvent,
  STOPPING,
  text,
  tracked,
  type BuilderState,
  type ToolContent,
  type ToolResult,
} from './builder-tool-common';

export const MAX_PHONE_VIEWS = 2;

const pad = (n: number) => String(n).padStart(2, '0');

/** A render that threw: the run stopping, or a runtime error in the build. */
async function lookFailed(state: BuilderState, toolName: string, err: unknown, started: number): Promise<ToolResult> {
  if (state.signal?.aborted) {
    await logEvent(state, { tool: toolName, cancelled: true, totalMs: Date.now() - started });
    return text(STOPPING, true);
  }
  const message = err instanceof Error ? err.message : String(err);
  await logEvent(state, { tool: toolName, error: message });
  return text(`Rendering failed — this is a runtime error in your code:\n${message}`, true);
}

function budgetSpent(state: BuilderState): ToolResult | null {
  if (state.roundsUsed < state.roundsMax) return null;
  return text(`The look budget is spent (${state.roundsMax}/${state.roundsMax}). Make any last fix with check, then call finish.`, true);
}

export function buildLookTools(state: BuilderState) {
  const roundsLine = () => `Look rounds used: ${state.roundsUsed}/${state.roundsMax}.`;
  const signal = () => (state.signal ? { signal: state.signal } : {});

  const renderStills = tool(
    'render_stills',
    'Check, then render frames of the current build and SHOW them to you at ~1024 px. One call = one look round (budgeted). Pick frames across the whole duration.',
    { frames: z.array(z.number().int()).min(1).max(12).describe('Frame numbers to render (0-based), at most 12') },
    tracked(state, 'rendering', async (args: { frames: number[] }) => {
      const spent = budgetSpent(state);
      if (spent) return spent;
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      state.roundsUsed += 1;
      const started = Date.now();
      try {
        const stills = await renderBuildStills(look.build.code, look.build.config, state.dirs.stillsDir, args.frames, {
          maxSide: 1024,
          label: `r${pad(state.roundsUsed)}`,
          ...signal(),
        });
        for (const still of stills.stills) {
          state.stills.push({ round: state.roundsUsed, frame: still.frame, size: 'model', path: still.path });
        }
        const frames = stills.stills.map((s) => s.frame);
        await logEvent(state, {
          tool: 'render_stills',
          round: state.roundsUsed,
          frames,
          ms: stills.ms,
          bundleCached: stills.bundleCached,
          totalMs: Date.now() - started,
        });
        state.onEvent?.({ type: 'stills', size: 'model', frames, paths: stills.stills.map((s) => s.path) });
        const content: ToolContent = [
          { type: 'text', text: `${look.build.summary}\nRendered frames ${frames.join(', ')}, in order below. ${roundsLine()}` },
        ];
        for (const still of stills.stills) {
          content.push({ type: 'text', text: `Frame ${still.frame}:` });
          content.push({ type: 'image', data: still.data, mimeType: still.mimeType });
        }
        return { content };
      } catch (err) {
        // A render failure is the build's fault (a runtime error), not the budget's.
        state.roundsUsed -= 1;
        return lookFailed(state, 'render_stills', err, started);
      }
    }),
  );

  const contactSheet = tool(
    'contact_sheet',
    `Check, then render up to ${CONTACT_SHEET_MAX_FRAMES} frames as small labelled tiles in ONE image (≤${CONTACT_SHEET_MAX_SIDE} px): the random-frame test — does the picture carry its message on ANY frame? One call = one look round (budgeted), like render_stills. Pick frames you have not looked at yet, mid-transition ones included.`,
    {
      frames: z
        .array(z.number().int())
        .min(2)
        .max(CONTACT_SHEET_MAX_FRAMES)
        .describe(`Frame numbers (0-based), ${CONTACT_SHEET_MAX_FRAMES} at most; shown in frame order`),
    },
    tracked(state, 'rendering', async (args: { frames: number[] }) => {
      const spent = budgetSpent(state);
      if (spent) return spent;
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      state.roundsUsed += 1;
      const started = Date.now();
      try {
        const sheet = await renderContactSheet(look.build.code, look.build.config, state.dirs.stillsDir, args.frames, {
          label: `r${pad(state.roundsUsed)}-sheet`,
          ...signal(),
        });
        state.stills.push({ round: state.roundsUsed, frame: sheet.frames[0], frames: sheet.frames, size: 'sheet', path: sheet.path });
        await logEvent(state, {
          tool: 'contact_sheet',
          round: state.roundsUsed,
          frames: sheet.frames,
          grid: `${sheet.layout.cols}x${sheet.layout.rows}`,
          ms: sheet.ms,
          bundleCached: sheet.bundleCached,
          totalMs: Date.now() - started,
        });
        state.onEvent?.({ type: 'stills', size: 'sheet', frames: sheet.frames, paths: [sheet.path] });
        const { cols, rows } = sheet.layout;
        return {
          content: [
            {
              type: 'text',
              text: `${look.build.summary}\nContact sheet: frames ${sheet.frames.join(', ')} in a ${cols}×${rows} grid, left to right then top to bottom, each tile labelled with its frame. ${roundsLine()}`,
            },
            { type: 'image', data: sheet.data, mimeType: sheet.mimeType },
          ],
        };
      } catch (err) {
        state.roundsUsed -= 1;
        return lookFailed(state, 'contact_sheet', err, started);
      }
    }),
  );

  const width = state.expect.width || 1080;
  const shownAt = PHONE_FEED_WIDTH / width;
  const phoneView = tool(
    'phone_view',
    `Check, then render ONE frame at the size a phone feed shows it: ${PHONE_FEED_WIDTH} px wide, whatever the format (a feed shows a post at the screen's width, ~${PHONE_FEED_WIDTH} pt). This build is ${width} px wide, so it is shown at ${Math.round(shownAt * 100)}%: text under ~${Math.ceil(11 / shownAt)} px drops below 11 pt. The legibility test — every label must be readable here. Free (no look round); at most ${MAX_PHONE_VIEWS} per build.`,
    { frame: z.number().int().describe('The frame with the smallest or densest text') },
    tracked(state, 'rendering', async (args: { frame: number }) => {
      if (state.phoneViews >= MAX_PHONE_VIEWS) {
        return text(`phone_view is used up (${MAX_PHONE_VIEWS}/${MAX_PHONE_VIEWS} for this build).`, true);
      }
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      state.phoneViews += 1;
      const started = Date.now();
      try {
        const view = await renderPhoneView(look.build.code, look.build.config, state.dirs.stillsDir, args.frame, {
          label: `phone${state.phoneViews}`,
          ...signal(),
        });
        state.stills.push({ round: state.roundsUsed, frame: view.frame, size: 'phone', path: view.path });
        await logEvent(state, { tool: 'phone_view', n: state.phoneViews, frame: view.frame, ms: view.ms, totalMs: Date.now() - started });
        state.onEvent?.({ type: 'stills', size: 'phone', frames: [view.frame], paths: [view.path] });
        return {
          content: [
            {
              type: 'text',
              text: `${look.build.summary}\nPhone view of frame ${view.frame}: ${view.width}x${view.height} px, the size a phone feed shows it. Phone views used: ${state.phoneViews}/${MAX_PHONE_VIEWS}.`,
            },
            { type: 'image', data: view.data, mimeType: view.mimeType },
          ],
        };
      } catch (err) {
        state.phoneViews -= 1;
        return lookFailed(state, 'phone_view', err, started);
      }
    }),
  );

  const loopSeam = tool(
    'loop_seam',
    'Loops only. Check, then measure whether the last frame flows into frame 0: renders frames last-1, last, 0 and 1, and returns the mean pixel difference of last → 0 against its neighbours, a verdict (JUMP or OK) and the box where the wrap changes. A still cannot show a jump; this can. Free (no look round).',
    {},
    tracked(state, 'rendering', async () => {
      if (!state.expect.loop) return text('This build is not a loop: loop_seam does not apply.', true);
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      state.seamChecks += 1;
      const started = Date.now();
      try {
        const seam = await measureLoopSeam(look.build.code, look.build.config, state.dirs.stillsDir, {
          label: `seam${state.seamChecks}`,
          ...signal(),
        });
        await logEvent(state, { tool: 'loop_seam', n: state.seamChecks, ...seam, totalMs: Date.now() - started });
        state.onEvent?.({ type: 'seam', jump: seam.jump, wrap: seam.wrap, neighbours: seam.neighbours });
        return text(`${look.build.summary}\n${describeSeam(seam, seam.last)}`);
      } catch (err) {
        return lookFailed(state, 'loop_seam', err, started);
      }
    }),
  );

  return [renderStills, contactSheet, phoneView, loopSeam];
}
