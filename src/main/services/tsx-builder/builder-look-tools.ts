// The builder's eyes (TSX_BUILDER_DESIGN.md T2): the three tools that show it
// pictures. Each checks first and renders the build that passed. (loop_seam
// and purity_check, which answer in numbers, are builder-measure-tools.ts.)
//
// - `render_stills` and `contact_sheet` are LOOK ROUNDS: budgeted, counted
//   toward the `finish` floor, given back when the render fails. `finish`
//   wants the final build looked at (P3 D1), so once the budget is spent a
//   look at a build changed since the last look is still allowed, up to
//   VERIFY_LOOK_ALLOWANCE. A WebGL piece's sheet renders tile by tile.
//   Both also give each frame's on-screen text (frame-text.ts, P4 part 2)
//   under its frame label, for the method's "read it against your model".
// - `phone_view` (at most MAX_PHONE_VIEWS per run) is free. `finish` refuses
//   until it has run (builder-tools.ts), so it records that in the state.
//
// Every image shown is recorded in `state.stills` and saved with the version.
//
// A transparent Studio shot (P3 part 5): the three picture looks render its
// look wrapper (footage or a checkerboard under the piece, look-backdrop.ts).
// Everything the run records (the last look) is keyed by the piece's own code.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { renderBuildStills, type BuildAssetSource } from './build-stills';
import { PHONE_FEED_WIDTH, renderContactSheet, renderPhoneView } from './build-looks';
import { CONTACT_SHEET_MAX_FRAMES, CONTACT_SHEET_MAX_SIDE } from './contact-sheet';
import { describeFrameText, FRAME_TEXT_NOTE } from './frame-text';
import {
  buildHash,
  checkForLook,
  giveBack,
  logEvent,
  lookFailed,
  takeLook,
  text,
  tracked,
  VERIFY_LOOK_ALLOWANCE,
  type BuilderState,
  type CheckedBuild,
  type ToolContent,
} from './builder-tool-common';

export const MAX_PHONE_VIEWS = 2;

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
    "Check, then render frames of the current build and SHOW them to you at ~1024 px, each with the text on that frame. One call = one look round (budgeted); once the budget is spent, a build you changed since your last look may still be looked at. Pick frames across the whole duration.",
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
          {
            type: 'text',
            text: `${look.build.summary}\nRendered frames ${frames.join(', ')}, in order below. Under each frame's label, the text on that frame (${FRAME_TEXT_NOTE}): read every number against your model at that frame. ${roundsLine()}`,
          },
        ];
        for (const still of stills.stills) {
          content.push({ type: 'text', text: `Frame ${still.frame}:\nText: ${describeFrameText(still.text)}` });
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
    `Check, then render up to ${CONTACT_SHEET_MAX_FRAMES} frames as small labelled tiles in ONE image (≤${CONTACT_SHEET_MAX_SIDE} px), with the text on each frame: the random-frame test — does the picture carry its message on ANY frame? One call = one look round (budgeted), like render_stills. Pick frames you have not looked at yet, mid-transition ones included.`,
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
        const textOf = new Map((sheet.text ?? []).map((t) => [t.frame, t.text]));
        const frameText = sheet.frames.map((f) => `Frame ${f}: ${describeFrameText(textOf.get(f))}`).join('\n');
        return {
          content: [
            {
              type: 'text',
              text: `${look.build.summary}\nContact sheet: frames ${sheet.frames.join(', ')} in a ${cols}×${rows} grid, left to right then top to bottom, each tile labelled with its frame. ${roundsLine()}\nText on each frame (${FRAME_TEXT_NOTE}); read every number against your model at that frame:\n${frameText}`,
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

  return [renderStills, contactSheet, phoneView];
}
