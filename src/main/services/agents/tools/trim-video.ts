// `trim_video` — keep `[start, end]` of a video artifact (flows plan §1.2, W8
// Stage 3) through `media/video-edit.ts`: a frame-accurate re-encode by
// default, a keyframe-aligned stream copy when speed matters more. The result
// is a new `video` artifact in the run's library folder.

import path from 'path';
import { z } from 'zod';
import type { MediaProbe } from '../../media/ffmpeg-run';
import { trimVideo, type TrimOptions } from '../../media/video-edit';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput, reserveLibraryOutput, resolveVideoFile } from './port-media';

const MODES = ['precise', 'fast'] as const;

const schema = {
  video: z.string().describe('The "video" artifact id.'),
  startSeconds: z.coerce.number().min(0).optional().describe('Keep from here (default 0).'),
  endSeconds: z.coerce.number().min(0).optional().describe('Keep until here; 0 or absent = the end.'),
  mode: z.enum(MODES).optional().describe('precise re-encodes (frame-accurate); fast copies streams (lands on a keyframe).'),
  name: z.string().optional().describe('Output file name, without an extension.'),
};

interface TrimVideoArgs {
  video: string;
  startSeconds?: number;
  endSeconds?: number;
  mode?: (typeof MODES)[number];
  name?: string;
}

export interface TrimVideoDeps {
  trim(opts: TrimOptions): Promise<MediaProbe>;
}

const defaultDeps: TrimVideoDeps = { trim: trimVideo };
let deps: TrimVideoDeps = defaultDeps;
export function setTrimVideoDepsForTests(next: TrimVideoDeps | null): void {
  deps = next ?? defaultDeps;
}

export const trimVideoTool: AgentToolDef<TrimVideoArgs> = {
  id: 'trim_video',
  description:
    'Cut a video artifact to a start/end range (seconds) with ffmpeg and file the result in the asset library. Free. Returns a new "video" artifact.',
  schema,
  ports: {
    label: 'Trim Video',
    category: 'video',
    inputs: [
      { id: 'video', label: 'Video', dataType: 'video', required: true, argKey: 'video' },
      { id: 'start', label: 'Start (s)', dataType: 'number', argKey: 'startSeconds' },
      { id: 'end', label: 'End (s)', dataType: 'number', argKey: 'endSeconds' },
    ],
    outputs: [{ id: 'video', label: 'Trimmed video', dataType: 'video', from: 'artifact' }],
    configSchema: [
      { kind: 'number', key: 'startSeconds', label: 'Start (seconds)', min: 0, max: 36000, step: 0.1 },
      { kind: 'number', key: 'endSeconds', label: 'End (seconds, 0 = the end)', min: 0, max: 36000, step: 0.1 },
      {
        kind: 'select',
        key: 'mode',
        label: 'Cut',
        options: [
          { value: 'precise', label: 'Precise — re-encode, frame-accurate' },
          { value: 'fast', label: 'Fast — copy streams, keyframe-aligned' },
        ],
      },
      { kind: 'text', key: 'name', label: 'Output name (optional)', placeholder: 'trimmed' },
    ],
    defaultConfig: { startSeconds: 0, endSeconds: 0, mode: 'precise', name: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    try {
      const { artifact, absPath: input } = await resolveVideoFile(ctx, args.video);
      const startSeconds = Math.max(0, args.startSeconds ?? 0);
      const endSeconds = Math.max(0, args.endSeconds ?? 0);
      const base = path.basename(input, path.extname(input));
      const baseName = args.name?.trim() || `${base}-trim`;
      const { relPath, absPath } = await reserveLibraryOutput({ libraryFolder: ctx.libraryFolder, baseName, ext: '.mp4' });
      ctx.emitProgress(`${startSeconds}s → ${endSeconds > 0 ? `${endSeconds}s` : 'end'}`);
      let lastTenth = -1;
      const out = await deps.trim({
        input,
        output: absPath,
        startSeconds,
        endSeconds,
        mode: args.mode ?? 'precise',
        signal: ctx.signal,
        onProgress: (fraction) => {
          const tenth = Math.floor(fraction * 10);
          if (tenth !== lastTenth) {
            lastTenth = tenth;
            ctx.emitProgress(`Trimming… ${tenth * 10}%`);
          }
        },
      });
      await indexLibraryOutput(relPath, `Trimmed ${artifact.title} (${startSeconds}s–${endSeconds > 0 ? `${endSeconds}s` : 'end'})`, ctx.brandId);
      return {
        ...toolText(`Trimmed video ready: ${relPath} (${out.duration.toFixed(1)} s).`),
        artifact: {
          kind: 'video',
          title: `${artifact.title} (trimmed)`.slice(0, 80),
          payload: { relPath, durationSeconds: out.duration, width: out.width, height: out.height, hasAudio: out.hasAudio },
        },
      };
    } catch (err) {
      return toolText(`Trim failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
