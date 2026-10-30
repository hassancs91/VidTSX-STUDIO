// `join_clips` — join video artifacts with a cut or a dip to black, at a set
// size and frame rate (interior staging flow, VidTSX 2.0). `concat_videos`
// only hard-cuts, and the bundled ffmpeg (Remotion's build) has no `fade`,
// `xfade`, `tpad`, `color`, `overlay` or `fps` filter, so this renders a fixed
// composition in main the way `caption_video` does: the shared
// `JoinClipsComposition` behind a generated entry (`media/join-entry.ts`),
// timed by `planJoin` (`shared/media/join-plan.ts`). The `videos` port
// collects its edges in edge order (`flow-args.ts`). New `video` artifact.

import { z } from 'zod';
import { planJoin, type JoinFit, type JoinTransition } from '../../../../shared/media/join-plan';
import { createJoinEntry, JOIN_COMPOSITION_ID } from '../../media/join-entry';
import { ensureAssetServerUrl } from '../../remotion-bundler';
import { probeMedia, type MediaProbe } from '../../media/ffmpeg-run';
import { renderTsxToMp4, type RenderTsxOptions, type RenderTsxResult } from '../../media/remotion-render';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput, reserveLibraryOutput, resolveVideoFile } from './port-media';

const TRANSITIONS = ['cut', 'dip-to-black'] as const;
const FITS = ['cover', 'contain'] as const;

const schema = {
  videos: z.array(z.string()).min(1).describe('"video" artifact ids, in order.'),
  transition: z.enum(TRANSITIONS).optional().describe('Between clips: a hard cut, or a dip to black (default).'),
  fadeOutSeconds: z.coerce.number().min(0).max(2).optional().describe('Dip: the outgoing clip fades to black over this (default 0.25).'),
  fadeInSeconds: z.coerce.number().min(0).max(2).optional().describe('Dip: the incoming clip fades up from black over this (default 0.3).'),
  width: z.coerce.number().int().min(0).max(4096).optional().describe('Output width in pixels; 0 = the first clip\'s.'),
  height: z.coerce.number().int().min(0).max(4096).optional().describe('Output height in pixels; 0 = the first clip\'s.'),
  fps: z.coerce.number().min(0).max(120).optional().describe('Output frame rate; 0 = the first clip\'s. Changing it re-times frames (judder).'),
  fit: z.enum(FITS).optional().describe('A clip of another shape: cover crops it to fill (default), contain letterboxes it.'),
  name: z.string().optional().describe('Output file name, without an extension.'),
};

interface JoinClipsArgs {
  videos: string[];
  transition?: JoinTransition;
  fadeOutSeconds?: number;
  fadeInSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  fit?: JoinFit;
  name?: string;
}

export interface JoinClipsDeps {
  probe(absPath: string): Promise<MediaProbe>;
  assetServerUrl(): Promise<string>;
  createEntry: typeof createJoinEntry;
  render(opts: RenderTsxOptions): Promise<RenderTsxResult>;
}

const defaultDeps: JoinClipsDeps = {
  probe: probeMedia,
  assetServerUrl: ensureAssetServerUrl,
  createEntry: createJoinEntry,
  render: renderTsxToMp4,
};

let deps: JoinClipsDeps = defaultDeps;
export function setJoinClipsDepsForTests(next: JoinClipsDeps | null): void {
  deps = next ?? defaultDeps;
}

export const joinClipsTool: AgentToolDef<JoinClipsArgs> = {
  id: 'join_clips',
  description:
    'Join one or more video artifacts back to back into one MP4 with a cut or a dip to black between them, at the size and frame rate you set (default: the first clip\'s), and file it in the asset library. Renders through Remotion — about real time. Free. Returns a new "video" artifact.',
  schema,
  ports: {
    label: 'Join with Transition',
    category: 'video',
    inputs: [{ id: 'videos', label: 'Videos', dataType: 'videos', required: true, argKey: 'videos' }],
    outputs: [{ id: 'video', label: 'Joined video', dataType: 'video', from: 'artifact' }],
    configSchema: [
      {
        kind: 'select',
        key: 'transition',
        label: 'Transition',
        options: [
          { value: 'dip-to-black', label: 'Dip to black' },
          { value: 'cut', label: 'Cut' },
        ],
      },
      { kind: 'number', key: 'fadeOutSeconds', label: 'Fade out (s)', min: 0, max: 2, step: 0.05 },
      { kind: 'number', key: 'fadeInSeconds', label: 'Fade in (s)', min: 0, max: 2, step: 0.05 },
      { kind: 'number', key: 'width', label: 'Width (0 = first clip)', min: 0, max: 4096, step: 2 },
      { kind: 'number', key: 'height', label: 'Height (0 = first clip)', min: 0, max: 4096, step: 2 },
      { kind: 'number', key: 'fps', label: 'Frame rate (0 = first clip)', min: 0, max: 120, step: 1 },
      {
        kind: 'select',
        key: 'fit',
        label: 'Other shapes',
        options: [
          { value: 'cover', label: 'Cover — crop to fill' },
          { value: 'contain', label: 'Contain — letterbox' },
        ],
      },
      { kind: 'text', key: 'name', label: 'Output name (optional)', placeholder: 'joined' },
    ],
    defaultConfig: {
      transition: 'dip-to-black',
      fadeOutSeconds: 0.25,
      fadeInSeconds: 0.3,
      width: 0,
      height: 0,
      fps: 0,
      fit: 'cover',
      name: '',
    },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    let cleanup: (() => Promise<void>) | null = null;
    try {
      const paths: string[] = [];
      const titles: string[] = [];
      const probes: MediaProbe[] = [];
      for (const [i, id] of args.videos.entries()) {
        const { artifact, absPath } = await resolveVideoFile(ctx, id);
        const probe = await deps.probe(absPath);
        if (!probe.hasVideo) return toolText(`Video ${i + 1} ("${artifact.title}") has no video stream.`, true);
        paths.push(absPath);
        titles.push(artifact.title);
        probes.push(probe);
      }
      const plan = planJoin(probes, {
        transition: args.transition ?? 'dip-to-black',
        fadeOutSeconds: args.fadeOutSeconds ?? 0.25,
        fadeInSeconds: args.fadeInSeconds ?? 0.3,
        ...(args.width ? { width: args.width } : {}),
        ...(args.height ? { height: args.height } : {}),
        ...(args.fps ? { fps: args.fps } : {}),
        fit: args.fit ?? 'cover',
      });

      const port = Number(new URL(await deps.assetServerUrl()).port) || 3100;
      const entry = await deps.createEntry(plan, paths, port);
      cleanup = entry.cleanup;
      const baseName = args.name?.trim() || 'joined';
      const { relPath, absPath } = await reserveLibraryOutput({ libraryFolder: ctx.libraryFolder, baseName, ext: '.mp4' });
      const seconds = plan.durationInFrames / plan.fps;
      ctx.emitProgress(`${paths.length} clips, ${seconds.toFixed(1)} s, ${plan.width}x${plan.height} at ${plan.fps} fps`);

      let lastStep = -1;
      let lastBundleStep = -1;
      await deps.render({
        entryPath: entry.entryPath,
        skipWrapper: true,
        compositionId: JOIN_COMPOSITION_ID,
        outputPath: absPath,
        width: plan.width,
        height: plan.height,
        fps: plan.fps,
        durationInFrames: plan.durationInFrames,
        signal: ctx.signal,
        onProgress: (phase, percent) => {
          const step = Math.floor(percent / (phase === 'bundling' ? 25 : 10));
          if (phase === 'bundling' ? step === lastBundleStep : step === lastStep) return;
          if (phase === 'bundling') lastBundleStep = step;
          else lastStep = step;
          ctx.emitProgress(`${phase === 'bundling' ? 'Bundling' : 'Rendering'}… ${percent}%`);
        },
      });
      await indexLibraryOutput(relPath, `Joined: ${titles.join(' + ')}`.slice(0, 200), ctx.brandId);
      const out = await deps.probe(absPath).catch(() => null);
      return {
        ...toolText(`Joined video ready: ${relPath} (${paths.length} clips, ${seconds.toFixed(2)} s, ${plan.width}x${plan.height} at ${plan.fps} fps).`),
        artifact: {
          kind: 'video',
          title: `Joined (${paths.length} clips)`,
          payload: {
            relPath,
            durationSeconds: out?.duration ?? seconds,
            width: out?.width ?? plan.width,
            height: out?.height ?? plan.height,
            hasAudio: out?.hasAudio ?? probes.some((p) => p.hasAudio),
          },
        },
      };
    } catch (err) {
      return toolText(`Join failed: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      if (cleanup) await cleanup().catch(() => {});
    }
  },
};
