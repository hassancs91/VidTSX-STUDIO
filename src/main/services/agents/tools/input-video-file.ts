// `input_video_file` — a video file as a `video` port value (flows plan §1.2,
// new in W8 Stage 1). Takes an absolute path (the inspector's text field, or a
// run param of kind `video`) or a Video Studio entry id; the file is COPIED
// into the run's library folder and probed for duration and size, then
// returned as a `video` artifact.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { getVideoFilePath } from '../../video-studio-db';
import { probeVideo } from '../../frame-extractor';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { importLibraryInput } from './port-media';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v']);

const schema = {
  filePath: z.string().optional().describe('Absolute path of a video file.'),
  entryId: z.string().optional().describe('Video Studio entry id, instead of a path.'),
};

interface InputVideoFileArgs {
  filePath?: string;
  entryId?: string;
}

export interface VideoInputDeps {
  entryPath(id: string): Promise<string | null>;
  probe(absPath: string): Promise<{ duration: number; width: number; height: number }>;
}

const defaultDeps: VideoInputDeps = {
  entryPath: (id) => getVideoFilePath(id),
  probe: (absPath) => probeVideo(absPath),
};

/** Test seam: replace the Video Studio lookup and the ffprobe call. */
let deps: VideoInputDeps = defaultDeps;
export function setVideoInputDepsForTests(next: VideoInputDeps | null): void {
  deps = next ?? defaultDeps;
}

export const inputVideoFileTool: AgentToolDef<InputVideoFileArgs> = {
  id: 'input_video_file',
  description:
    'Bring a video file into the run as a "video" artifact — an absolute path or a Video Studio entry id. A flow input node; the file is picked in the inspector or bound to a run parameter.',
  schema,
  ports: {
    label: 'Video File',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'video', label: 'Video', dataType: 'video', from: 'artifact' }],
    configSchema: [
      { kind: 'text', key: 'filePath', label: 'Video file (absolute path)', placeholder: 'C:\\…\\clip.mp4' },
      { kind: 'text', key: 'entryId', label: 'Or a Video Studio entry id', placeholder: 'optional' },
    ],
    defaultConfig: { filePath: '', entryId: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    let sourcePath = args.filePath?.trim() || '';
    if (!sourcePath && args.entryId) {
      sourcePath = (await deps.entryPath(args.entryId)) ?? '';
      if (!sourcePath) {
        return toolText(`Video Studio entry "${args.entryId}" no longer exists — pick another.`, true);
      }
    }
    if (!sourcePath) return toolText('No video chosen — enter a file path in the inspector.', true);
    try {
      await fs.access(sourcePath);
    } catch {
      return toolText(`The video file ${sourcePath} could not be read.`, true);
    }
    const ext = path.extname(sourcePath).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) return toolText(`${path.basename(sourcePath)} is not a video file.`, true);

    ctx.emitProgress(path.basename(sourcePath));
    const baseName = path.basename(sourcePath, ext);
    const { relPath, absPath } = await importLibraryInput({
      libraryFolder: ctx.libraryFolder,
      baseName,
      ext,
      sourcePath,
      description: path.basename(sourcePath),
    });
    let probe: { duration: number; width: number; height: number } | null = null;
    try {
      probe = await deps.probe(absPath);
    } catch (err) {
      ctx.emitProgress(`Could not probe the clip: ${err instanceof Error ? err.message : String(err)}`);
    }
    return {
      ...toolText(`Video ready: ${relPath}${probe ? ` (${probe.width}x${probe.height}, ${probe.duration.toFixed(1)}s)` : ''}.`),
      artifact: {
        kind: 'video',
        title: path.basename(sourcePath).slice(0, 80),
        payload: {
          relPath,
          durationSeconds: probe?.duration ?? 0,
          ...(probe ? { width: probe.width, height: probe.height } : {}),
        },
      },
    };
  },
};
