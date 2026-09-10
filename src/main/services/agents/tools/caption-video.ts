// `caption_video` — burn a transcript into a video (flows plan §1.2, W8 Stage
// 3). The bundled ffmpeg (Remotion's build) has neither the `subtitles` nor
// the `drawtext` filter, so burn-in is what the app already does for the
// Captions tool: a self-registering caption composition (`caption-composition.ts`,
// mode `burnin`, the clip served over the bundler's asset route) rendered in
// main through `media/remotion-render.ts`. Word timings, when the transcript
// has them, are grouped into caption lines by the Studio's `groupCaptionWords`;
// otherwise the STT segments are shown as they are.

import path from 'path';
import { z } from 'zod';
import type { SttWord } from '../../../../transcription-engine/types';
import { groupCaptionWords } from '../../../../shared/studio/caption-words';
import { createCaptionEntry, type CaptionSegment } from '../../caption-composition';
import { ensureAssetServerUrl } from '../../remotion-bundler';
import { probeMedia, type MediaProbe } from '../../media/ffmpeg-run';
import { renderTsxToMp4, type RenderTsxOptions, type RenderTsxResult } from '../../media/remotion-render';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { indexLibraryOutput, reserveLibraryOutput, resolveTranscript, resolveVideoFile } from './port-media';
import { readWorkspaceFile } from './workspace-files';

const STYLES = ['minimal', 'bold-pop', 'karaoke'] as const;

const schema = {
  video: z.string().describe('The "video" artifact id to caption.'),
  transcript: z.string().describe('The transcript "document" artifact id (from transcribe).'),
  style: z.enum(STYLES).optional().describe('Caption style (default minimal).'),
  wordsPerGroup: z.coerce.number().int().min(1).max(6).optional().describe('Words per caption line when word timings exist (default 4).'),
  name: z.string().optional().describe('Output file name, without an extension.'),
};

interface CaptionVideoArgs {
  video: string;
  transcript: string;
  style?: (typeof STYLES)[number];
  wordsPerGroup?: number;
  name?: string;
}

interface TranscriptJson {
  segments?: Array<{ start: number; end: number; text: string }>;
  words?: SttWord[];
}

export interface CaptionVideoDeps {
  probe(absPath: string): Promise<MediaProbe>;
  assetServerUrl(): Promise<string>;
  createEntry: typeof createCaptionEntry;
  render(opts: RenderTsxOptions): Promise<RenderTsxResult>;
}

const defaultDeps: CaptionVideoDeps = {
  probe: probeMedia,
  assetServerUrl: ensureAssetServerUrl,
  createEntry: createCaptionEntry,
  render: renderTsxToMp4,
};

let deps: CaptionVideoDeps = defaultDeps;
export function setCaptionVideoDepsForTests(next: CaptionVideoDeps | null): void {
  deps = next ?? defaultDeps;
}

/** Caption lines from a transcript: grouped words when timings exist, the STT segments otherwise. */
export function captionSegments(transcript: TranscriptJson, wordsPerGroup: number): CaptionSegment[] {
  if (transcript.words && transcript.words.length > 0) {
    return groupCaptionWords([{ clipId: 'clip', words: transcript.words }], wordsPerGroup).map((g) => ({
      start: g.start,
      end: g.end,
      text: g.words.map((w) => w.text).join(' '),
    }));
  }
  return (transcript.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })).filter((s) => s.text.length > 0);
}

export const captionVideoTool: AgentToolDef<CaptionVideoArgs> = {
  id: 'caption_video',
  description:
    'Burn a transcript into a video as styled captions and file the result in the asset library. Renders the clip through Remotion — takes about real time. Returns a new "video" artifact.',
  schema,
  ports: {
    label: 'Caption Video',
    category: 'video',
    inputs: [
      { id: 'video', label: 'Video', dataType: 'video', required: true, argKey: 'video' },
      { id: 'transcript', label: 'Transcript', dataType: 'transcript', required: true, argKey: 'transcript' },
    ],
    outputs: [{ id: 'video', label: 'Captioned video', dataType: 'video', from: 'artifact' }],
    configSchema: [
      {
        kind: 'select',
        key: 'style',
        label: 'Style',
        options: [
          { value: 'minimal', label: 'Minimal — white on a dark pill' },
          { value: 'bold-pop', label: 'Bold pop — big outlined words' },
          { value: 'karaoke', label: 'Karaoke — words light up' },
        ],
      },
      { kind: 'number', key: 'wordsPerGroup', label: 'Words per line', min: 1, max: 6, step: 1 },
      { kind: 'text', key: 'name', label: 'Output name (optional)', placeholder: 'captioned' },
    ],
    defaultConfig: { style: 'minimal', wordsPerGroup: 4, name: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    let cleanup: (() => Promise<void>) | null = null;
    try {
      const { artifact: video, absPath: videoPath } = await resolveVideoFile(ctx, args.video);
      const { meta } = resolveTranscript(ctx, args.transcript);
      const transcript = JSON.parse(await readWorkspaceFile(ctx.workspaceDir, meta.jsonRelPath)) as TranscriptJson;
      const segments = captionSegments(transcript, args.wordsPerGroup ?? 4);
      if (segments.length === 0) return toolText('The transcript has no caption lines to burn in.', true);

      const probe = await deps.probe(videoPath);
      if (!probe.hasVideo) return toolText('The input has no video stream.', true);
      const fps = probe.fps > 0 ? probe.fps : 30;
      const durationInFrames = Math.max(1, Math.ceil((probe.duration || meta.durationSeconds) * fps));
      const style = args.style ?? 'minimal';
      const compositionId = `captions-${style}-burnin`;
      const port = Number(new URL(await deps.assetServerUrl()).port) || 3100;
      ctx.emitProgress(`${segments.length} caption lines, ${style}`);

      const entry = await deps.createEntry({
        styleId: style,
        mode: 'burnin',
        compositionId,
        width: probe.width || 1920,
        height: probe.height || 1080,
        fps,
        durationInFrames,
        videoPath,
        bundlerPort: port,
        segments,
      });
      cleanup = entry.cleanup;

      const baseName = args.name?.trim() || `${path.basename(videoPath, path.extname(videoPath))}-captioned`;
      const { relPath, absPath } = await reserveLibraryOutput({ libraryFolder: ctx.libraryFolder, baseName, ext: '.mp4' });
      let lastStep = -1;
      let lastBundleStep = -1;
      await deps.render({
        entryPath: entry.entryPath,
        skipWrapper: true,
        compositionId,
        outputPath: absPath,
        width: probe.width || 1920,
        height: probe.height || 1080,
        fps,
        durationInFrames,
        signal: ctx.signal,
        onProgress: (phase, percent) => {
          const step = Math.floor(percent / (phase === 'bundling' ? 25 : 10));
          if (phase === 'bundling' ? step === lastBundleStep : step === lastStep) return;
          if (phase === 'bundling') lastBundleStep = step;
          else lastStep = step;
          ctx.emitProgress(`${phase === 'bundling' ? 'Bundling' : 'Rendering'}… ${percent}%`);
        },
      });
      await indexLibraryOutput(relPath, `Captioned: ${video.title}`, ctx.brandId);
      const out = await deps.probe(absPath).catch(() => null);
      return {
        ...toolText(`Captioned video ready: ${relPath} (${segments.length} lines, ${style}).`),
        artifact: {
          kind: 'video',
          title: `${video.title} (captioned)`.slice(0, 80),
          payload: {
            relPath,
            durationSeconds: out?.duration ?? probe.duration,
            width: out?.width ?? probe.width,
            height: out?.height ?? probe.height,
            hasAudio: out?.hasAudio ?? probe.hasAudio,
          },
        },
      };
    } catch (err) {
      return toolText(`Captioning failed: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      if (cleanup) await cleanup().catch(() => {});
    }
  },
};
