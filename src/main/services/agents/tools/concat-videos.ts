// `concat_videos` — join several video artifacts into one (flows plan §1.2,
// W8 Stage 3). The `videos` port collects every incoming edge in edge order
// (`flow-args.ts`, the way `images` does); `media/video-edit.ts` scales each
// clip to the first one's size and rate, gives silent clips a silent track,
// and re-encodes through the concat filter. New `video` artifact.

import { z } from 'zod';
import type { MediaProbe } from '../../media/ffmpeg-run';
import { concatVideos, type ConcatOptions } from '../../media/video-edit';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput, reserveLibraryOutput, resolveVideoFile } from './port-media';

const schema = {
  videos: z.array(z.string()).min(1).describe('"video" artifact ids, in order.'),
  name: z.string().optional().describe('Output file name, without an extension.'),
};

interface ConcatVideosArgs {
  videos: string[];
  name?: string;
}

export interface ConcatVideosDeps {
  concat(opts: ConcatOptions): Promise<MediaProbe>;
}

const defaultDeps: ConcatVideosDeps = { concat: concatVideos };
let deps: ConcatVideosDeps = defaultDeps;
export function setConcatVideosDepsForTests(next: ConcatVideosDeps | null): void {
  deps = next ?? defaultDeps;
}

export const concatVideosTool: AgentToolDef<ConcatVideosArgs> = {
  id: 'concat_videos',
  description:
    'Join two or more video artifacts back to back into one MP4 (scaled to the first clip) and file it in the asset library. Free. Returns a new "video" artifact.',
  schema,
  ports: {
    label: 'Join Videos',
    category: 'video',
    inputs: [{ id: 'videos', label: 'Videos', dataType: 'videos', required: true, argKey: 'videos' }],
    outputs: [{ id: 'video', label: 'Joined video', dataType: 'video', from: 'artifact' }],
    configSchema: [{ kind: 'text', key: 'name', label: 'Output name (optional)', placeholder: 'joined' }],
    defaultConfig: { name: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    try {
      const inputs: string[] = [];
      const titles: string[] = [];
      for (const id of args.videos) {
        const { artifact, absPath } = await resolveVideoFile(ctx, id);
        inputs.push(absPath);
        titles.push(artifact.title);
      }
      const baseName = args.name?.trim() || 'joined';
      const { relPath, absPath } = await reserveLibraryOutput({ libraryFolder: ctx.libraryFolder, baseName, ext: '.mp4' });
      ctx.emitProgress(`${inputs.length} clips`);
      let lastTenth = -1;
      const out = await deps.concat({
        inputs,
        output: absPath,
        signal: ctx.signal,
        onProgress: (fraction) => {
          const tenth = Math.floor(fraction * 10);
          if (tenth !== lastTenth) {
            lastTenth = tenth;
            ctx.emitProgress(`Joining… ${tenth * 10}%`);
          }
        },
      });
      await indexLibraryOutput(relPath, `Joined: ${titles.join(' + ')}`.slice(0, 200), ctx.brandId);
      return {
        ...toolText(`Joined video ready: ${relPath} (${inputs.length} clips, ${out.duration.toFixed(1)} s).`),
        artifact: {
          kind: 'video',
          title: `Joined (${inputs.length} clips)`,
          payload: { relPath, durationSeconds: out.duration, width: out.width, height: out.height, hasAudio: out.hasAudio },
        },
      };
    } catch (err) {
      return toolText(`Join failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
