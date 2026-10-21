// The builder's three measuring tools (TSX_BUILDER_DESIGN.md T2): they answer in
// numbers and a verdict, not a picture. Split from builder-look-tools.ts (P4
// part 2), which keeps the three picture looks.
//
// - `loop_seam` (loops only) is free. `finish` refuses a loop until the last
//   seam measured exactly the build being finished and said OK.
// - `purity_check` (P2 part 3) is free: the same frames in order in one page
//   and alone in fresh pages must match. `finish` refuses a piece that uses a
//   physics engine until it says PURE, so it records its verdict too.
// - `number_check` (P4-12) is free: the text of (nearly) every frame, each
//   number followed across frames, against the step labels beside it
//   (number-check.ts). `finish` refuses a piece whose looks showed moving
//   numbers until it says OK on the build being finished.
//
// All three measure the piece alone, never a transparent shot's look wrapper.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { measureFramePurity, measureLoopSeam } from './build-looks';
import { describeSeam } from './loop-seam';
import { describePurity, PURITY_MAX_FRAMES, PURITY_MAX_SIDE } from './frame-purity';
import { buildHash, checkForLook, logEvent, lookFailed, text, tracked, type BuilderState } from './builder-tool-common';
import type { BuildAssetSource } from './build-stills';
import { checkNumbers, describeNumberCheck } from './number-check';
import { sweepFrameText } from './number-sweep';

export function buildMeasureTools(state: BuilderState) {
  const signal = () => (state.signal ? { signal: state.signal } : {});
  /** The signal, and the build's files when it names any. */
  const renderOptions = (build: { assets?: BuildAssetSource }) => ({ ...signal(), ...(build.assets ? { assets: build.assets } : {}) });

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

  const numberCheck = tool(
    'number_check',
    'Check, then read the on-screen text of (nearly) every frame and follow each number across the frames: a number that changes while a step label beside it ("YEAR 7", "STEP 12") holds runs on a second clock, and the verdict is SPLIT with the frames and what they read. Numbers that never change while others move are listed (a unit or a given is fine; a result typed in at its final value is not). Text drawn on a canvas, in 3D or in an image is not read. Free (no look round); run it after your last change.',
    {},
    tracked(state, 'rendering', async () => {
      const look = await checkForLook(state);
      if ('reply' in look) return look.reply;
      state.numberChecks += 1;
      const started = Date.now();
      try {
        const sweep = await sweepFrameText(look.build.code, look.build.config, state.dirs.stillsDir, {
          label: `numbers${state.numberChecks}`,
          webgl: look.build.webgl,
          ...renderOptions(look.build),
        });
        const result = checkNumbers(sweep.frames, look.build.config);
        const build = buildHash(look.build.code);
        // What `finish` holds a piece with moving numbers to: this exact build, this verdict.
        state.lastNumbers = { code: look.build.code, ok: result.ok };
        if (!result.ok) state.numberSplitBuilds.add(build);
        await logEvent(state, {
          tool: 'number_check',
          n: state.numberChecks,
          build,
          ok: result.ok,
          swept: result.swept,
          step: sweep.step,
          tiles: sweep.tiles,
          unread: sweep.unread,
          tracks: result.tracks,
          stepLabels: result.stepLabels,
          splits: result.splits.map((s) => ({ step: s.step, other: s.other, frames: s.frames.length, example: s.example })),
          fixed: result.fixed,
          ms: sweep.ms,
          totalMs: Date.now() - started,
        });
        const note = sweep.step > 1 ? `, every ${sweep.step}th frame` : '';
        return text(`${look.build.summary}\n${describeNumberCheck(result, note)}`);
      } catch (err) {
        return lookFailed(state, 'number_check', err, started);
      }
    }),
  );

  return [loopSeam, purityCheck, numberCheck];
}
