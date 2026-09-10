// `extract_frame` — one frame, or a strip of frames, from a video artifact
// (flows plan §1.2, W8 Stage 3): the Frame Extractor's ffmpeg grab, one
// `-ss <t> -frames:v 1` per frame, filed into the run's library folder as an
// `image-set`. `count: 1` samples at `atSeconds`; a larger count samples the
// centre of `count` equal slices across the clip (the `vidtsx/frame-strip`
// built-in). Both output ports carry the same set: `image` for a consumer
// that takes one picture (it reads the first), `images` for a strip.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { probeMedia, type MediaProbe } from '../../media/ffmpeg-run';
import { extractFrameAt, stripTimes, type ExtractFrameOptions } from '../../media/video-edit';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput, readImageDimensions, reserveLibraryOutput, resolveVideoFile } from './port-media';

const MAX_COUNT = 24;
const FORMATS = ['png', 'jpg'] as const;

const schema = {
  video: z.string().describe('The "video" artifact id.'),
  atSeconds: z.coerce.number().min(0).optional().describe('Time of the frame (single frame only). Default 0.'),
  count: z.coerce.number().int().min(1).max(MAX_COUNT).optional().describe('Frames to sample evenly across the clip (default 1).'),
  format: z.enum(FORMATS).optional().describe('png (default) or jpg.'),
};

interface ExtractFrameArgs {
  video: string;
  atSeconds?: number;
  count?: number;
  format?: (typeof FORMATS)[number];
}

export interface ExtractFrameDeps {
  probe(absPath: string): Promise<MediaProbe>;
  extract(opts: ExtractFrameOptions): Promise<void>;
}

const defaultDeps: ExtractFrameDeps = { probe: probeMedia, extract: extractFrameAt };
let deps: ExtractFrameDeps = defaultDeps;
export function setExtractFrameDepsForTests(next: ExtractFrameDeps | null): void {
  deps = next ?? defaultDeps;
}

export const extractFrameTool: AgentToolDef<ExtractFrameArgs> = {
  id: 'extract_frame',
  description:
    'Grab one frame from a video artifact at a time, or a strip of N frames sampled evenly across it, as PNG or JPG in the asset library. Free and fast. Returns an "image-set" artifact.',
  schema,
  ports: {
    label: 'Extract Frame',
    category: 'video',
    inputs: [
      { id: 'video', label: 'Video', dataType: 'video', required: true, argKey: 'video' },
      { id: 'time', label: 'Time (s)', dataType: 'number', argKey: 'atSeconds' },
    ],
    outputs: [
      { id: 'image', label: 'Frame', dataType: 'image', from: 'artifact' },
      { id: 'images', label: 'Frames', dataType: 'images', from: 'artifact' },
    ],
    configSchema: [
      { kind: 'number', key: 'atSeconds', label: 'At (seconds, single frame)', min: 0, max: 36000, step: 0.1 },
      { kind: 'number', key: 'count', label: 'Frames (1 = single, more = a strip)', min: 1, max: MAX_COUNT, step: 1 },
      {
        kind: 'select',
        key: 'format',
        label: 'Format',
        options: [
          { value: 'png', label: 'PNG (lossless)' },
          { value: 'jpg', label: 'JPG (smaller)' },
        ],
      },
    ],
    defaultConfig: { atSeconds: 0, count: 1, format: 'png' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    try {
      const { artifact, absPath: videoPath } = await resolveVideoFile(ctx, args.video);
      const probe = await deps.probe(videoPath);
      if (!probe.hasVideo) return toolText('The input has no video stream.', true);
      const count = Math.min(MAX_COUNT, Math.max(1, Math.round(args.count ?? 1)));
      const times = stripTimes(probe.duration, count, args.atSeconds ?? 0);
      const ext = `.${args.format ?? 'png'}`;
      const base = path.basename(videoPath, path.extname(videoPath));
      ctx.emitProgress(count === 1 ? `frame at ${times[0].toFixed(2)} s` : `${count} frames across ${probe.duration.toFixed(1)} s`);

      const items: Array<{ relPath: string; width: number; height: number }> = [];
      for (const [i, atSeconds] of times.entries()) {
        if (ctx.signal.aborted) throw new Error('Cancelled.');
        // The time leads the name: the library slug is capped at 40 chars and a
        // long source name would otherwise eat it (seen on the first live run).
        const { relPath, absPath } = await reserveLibraryOutput({
          libraryFolder: ctx.libraryFolder,
          subfolder: 'frames',
          baseName: `f${atSeconds.toFixed(2).replace('.', '-')}s-${base}`,
          ext,
        });
        await deps.extract({ input: videoPath, output: absPath, atSeconds, signal: ctx.signal });
        const dims = readImageDimensions(await fs.readFile(absPath)) ?? { width: probe.width, height: probe.height };
        await indexLibraryOutput(relPath, `Frame ${i + 1}/${count} of ${artifact.title} at ${atSeconds.toFixed(2)} s`, ctx.brandId);
        items.push({ relPath, ...dims });
      }
      return {
        ...toolText(
          items.length === 1
            ? `Frame extracted: ${items[0].relPath} (${items[0].width}x${items[0].height}).`
            : `${items.length} frames extracted: ${items.map((i) => path.basename(i.relPath)).join(', ')}.`,
        ),
        artifact: {
          kind: 'image-set',
          title: (items.length === 1 ? `Frame of ${artifact.title}` : `${items.length} frames of ${artifact.title}`).slice(0, 80),
          payload: { items },
        },
      };
    } catch (err) {
      return toolText(`Frame extraction failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
