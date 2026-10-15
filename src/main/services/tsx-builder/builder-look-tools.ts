// The builder's eyes (TSX_BUILDER_DESIGN.md T2): the five tools that render.
// Each checks first and renders the build that passed.
//
// - `render_stills` and `contact_sheet` are LOOK ROUNDS: budgeted, counted
//   toward the `finish` floor, given back when the render fails. `finish`
//   wants the final build looked at (P3 D1), so once the budget is spent a
//   look at a build changed since the last look is still allowed, up to
//   VERIFY_LOOK_ALLOWANCE. A WebGL piece's sheet renders tile by tile.
// - `phone_view` (at most MAX_PHONE_VIEWS per run) and `loop_seam` (loops
//   only) are free. `finish` refuses until both have done their job
//   (builder-tools.ts), so they record what they saw in the state.
// - `purity_check` (P2 part 3) is free: the same frames in order in one page
//   and alone in fresh pages must match. `finish` refuses a piece that uses a
//   physics engine until it says PURE, so it records its verdict too.
//
// Every image shown is recorded in `state.stills` and saved with the version.
//
// A transparent Studio shot (P3 part 5): the three picture looks render its
// look wrapper (footage or a checkerboard under the piece, look-backdrop.ts);
// loop_seam and purity_check measure the piece alone. Everything the run
// records (the last look, the seam, purity) is keyed by the piece's own code.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { renderBuildStills, type BuildAssetSource } from './build-stills';
import { measureFramePurity, measureLoopSeam, PHONE_FEED_WIDTH, renderContactSheet, renderPhoneView } from './build-looks';
import { CONTACT_SHEET_MAX_FRAMES, CONTACT_SHEET_MAX_SIDE } from './contact-sheet';
import { describeSeam } from './loop-seam';
import { describePurity, PURITY_MAX_FRAMES, PURITY_MAX_SIDE } from './frame-purity';
import {
  buildHash,
  checkForLook,
  giveBack,
  logEvent,
  STOPPING,
  takeLook,
  text,
  tracked,
  VERIFY_LOOK_ALLOWANCE,
  type BuilderState,
  type CheckedBuild,
  type ToolContent,
  type ToolResult,
} from './builder-tool-common';

export const MAX_PHONE_VIEWS = 2;

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

export function buildLookTools(state: BuilderState) {
  const roundsLine = () =>
    `Look rounds used: ${state.roundsUsed}/${state.roundsMax}${state.verifyLooks > 0 ? `, plus ${state.verifyLooks}/${VERIFY_LOOK_ALLOWANCE} extra looks at a changed build` : ''}.`;
  const signal = () => (state.signal ? { signal: state.signal } : {});
  /** The signal, and the build's files when it names any. */
  const renderOptions = (build: { assets?: BuildAssetSource }) => ({ ...signal(), ...(build.assets ? { assets: build.assets } : {}) });
  /** What a picture look renders: the look wrapper of a transparent shot, else the piece. */
  const picture = (build: CheckedBuild) => ({
    code: build.look?.code ?? build.code,
    options: {
      ...renderOptions(build),
      ...(build.look ? { entryName: build.look.entryName } : {}),
      ...(build.look?.backdropFile ? { backdropFile: build.look.backdropFile } : {}),
    },
  });

  const renderStills = tool(
    'render_stills',
    'Check, then render frames of the current build and SHOW them to you at ~1024 px. One call = one look round (budgeted); once the budget is spent, a build you changed since your last look may still be looked at. Pick frames across the whole duration.',
    { frames: z.array(z.number().int()).min(1).max(12).describe('Frame numbers to render (0-based), at most 12') },
    tracked(state, 'rendering', async (args: { frames: number[] }) => {
      // Check first: a spent budget still allows a look at a changed build.
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      const slot = takeLook(state, look.build.code);
      if (!('verify' in slot)) return slot;
      const started = Date.now();
      try {
        const shown = picture(look.build);
        const stills = await renderBuildStills(shown.code, look.build.config, state.dirs.stillsDir, args.frames, {
          maxSide: 1024,
          label: slot.label,
          ...shown.options,
        });
        state.lastLook = { code: look.build.code };
        for (const still of stills.stills) {
          state.stills.push({ round: state.roundsUsed, frame: still.frame, size: 'model', path: still.path });
        }
        const frames = stills.stills.map((s) => s.frame);
        await logEvent(state, {
          tool: 'render_stills',
          round: state.roundsUsed,
          ...(slot.verify ? { verify: state.verifyLooks } : {}),
          build: buildHash(look.build.code),
          frames,
          ms: stills.ms,
          bundleCached: stills.bundleCached,
          gl: stills.gl,
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
        giveBack(state, slot);
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
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      const slot = takeLook(state, look.build.code);
      if (!('verify' in slot)) return slot;
      const started = Date.now();
      try {
        const shown = picture(look.build);
        const sheet = await renderContactSheet(shown.code, look.build.config, state.dirs.stillsDir, args.frames, {
          label: `${slot.label}-sheet`,
          // P2 problem 1: a dozen WebGL canvases in one page lose a context.
          separateTiles: look.build.webgl,
          ...shown.options,
        });
        state.lastLook = { code: look.build.code };
        state.stills.push({ round: state.roundsUsed, frame: sheet.frames[0], frames: sheet.frames, size: 'sheet', path: sheet.path });
        await logEvent(state, {
          tool: 'contact_sheet',
          round: state.roundsUsed,
          ...(slot.verify ? { verify: state.verifyLooks } : {}),
          build: buildHash(look.build.code),
          frames: sheet.frames,
          grid: `${sheet.layout.cols}x${sheet.layout.rows}`,
          tiles: sheet.tiles,
          ms: sheet.ms,
          bundleCached: sheet.bundleCached,
          gl: sheet.gl,
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
        giveBack(state, slot);
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
        const shown = picture(look.build);
        const view = await renderPhoneView(shown.code, look.build.config, state.dirs.stillsDir, args.frame, {
          label: `phone${state.phoneViews}`,
          ...shown.options,
        });
        state.stills.push({ round: state.roundsUsed, frame: view.frame, size: 'phone', path: view.path });
        await logEvent(state, { tool: 'phone_view', n: state.phoneViews, frame: view.frame, ms: view.ms, gl: view.gl, totalMs: Date.now() - started });
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
          ...renderOptions(look.build),
        });
        // What `finish` holds the loop to: this exact build, this verdict.
        const build = buildHash(look.build.code);
        state.lastSeam = { code: look.build.code, jump: seam.jump };
        if (seam.jump) state.seamJumps.add(build);
        await logEvent(state, { tool: 'loop_seam', n: state.seamChecks, build, ...seam, totalMs: Date.now() - started });
        state.onEvent?.({ type: 'seam', jump: seam.jump, wrap: seam.wrap, neighbours: seam.neighbours });
        return text(`${look.build.summary}\n${describeSeam(seam, seam.last)}`);
      } catch (err) {
        return lookFailed(state, 'loop_seam', err, started);
      }
    }),
  );

  const purityCheck = tool(
    'purity_check',
    `Check, then test that every frame is a function of its frame number alone: renders sample frames IN ORDER in one page (the way the preview plays them) and each ALONE in a fresh page, last first (the way a still and every export tab render them), at ${PURITY_MAX_SIDE} px, and compares the pixels. Returns PURE or IMPURE with each frame's difference and the box where it differs. A still cannot show this; an export would. Run it on anything that simulates (physics, a force layout) or keeps state between frames, after your last change. Free (no look round).`,
    {
      frames: z
        .array(z.number().int())
        .min(1)
        .max(PURITY_MAX_FRAMES)
        .optional()
        .describe(`Up to ${PURITY_MAX_FRAMES} frames to test (default: a third, two thirds and the last frame). Pick where the most has moved.`),
    },
    tracked(state, 'rendering', async (args: { frames?: number[] }) => {
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      state.purityChecks += 1;
      const started = Date.now();
      try {
        const purity = await measureFramePurity(look.build.code, look.build.config, state.dirs.stillsDir, {
          label: `purity${state.purityChecks}`,
          ...(args.frames?.length ? { frames: args.frames } : {}),
          ...renderOptions(look.build),
        });
        const build = buildHash(look.build.code);
        // What `finish` holds a physics piece to: this exact build, this verdict.
        state.lastPurity = { code: look.build.code, pure: purity.pure };
        if (!purity.pure) state.impureBuilds.add(build);
        const frames = purity.frames.map((f) => f.frame);
        const worst = Math.max(0, ...purity.frames.map((f) => f.mean));
        await logEvent(state, {
          tool: 'purity_check',
          n: state.purityChecks,
          build,
          pure: purity.pure,
          frames: purity.frames,
          scale: purity.scale,
          inOrderFrames: purity.inOrderFrames,
          ms: purity.ms,
          bundleCached: purity.bundleCached,
          gl: purity.gl,
          totalMs: Date.now() - started,
        });
        state.onEvent?.({ type: 'purity', pure: purity.pure, frames, worst });
        return text(`${look.build.summary}\n${describePurity(purity, purity.scale)}`);
      } catch (err) {
        return lookFailed(state, 'purity_check', err, started);
      }
    }),
  );

  return [renderStills, contactSheet, phoneView, loopSeam, purityCheck];
}
