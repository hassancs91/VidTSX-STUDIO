/**
 * The passthrough engine's audio, off the critical path (docs/export-engines-plan.md
 * Stage 4). The one ffmpeg pass over the whole timeline (D6/D7, Stage 3
 * slices 1–4) needs only the sources and the document, so it starts the
 * moment the plan is known and runs BESIDE the copied spans; the finishing
 * stage's AAC encode — the same binary, the same settings, PCM in — follows
 * it there too. Measured 2026-09-09 on the 3 h project: the native AAC
 * encoder is single-threaded at ~8× realtime, 22 of the 24 mux minutes,
 * while the copies keep the GPU busy and the CPU idle. The mux then copies
 * both streams.
 */
import fs from 'fs/promises';
import path from 'path';
import { planExportAudio } from '../../../../shared/studio/export-spans';
import { runFfmpeg } from '../ffmpeg-bin';
import { encodeExportAudio } from './finishing';
import { audioPassArgs } from './passthrough-ffmpeg';
import type { ExportEngineInput } from './types';

export interface PassthroughAudio {
  /** Absent → the finishing stage renders the audio by the standard path. */
  audioPath?: string;
  notes: string[];
}

export const AUDIO_STANDARD_PATH_NOTE = 'Audio mixed by the standard path (the one pass could not plan this timeline).';

/**
 * Plan, mix (the full ffmpeg) and AAC-encode (Remotion's ffmpeg) the
 * timeline's audio. `videoPath` is the joined video the finishing stage will
 * see: a timeline with no sound hands it back as its own audio source, which
 * the finishing stage reads as "no audio track".
 */
export async function producePassthroughAudio(input: ExportEngineInput, ffmpeg: string, videoPath: string): Promise<PassthroughAudio> {
  const { project, entry, workDir, signal } = input;
  const audioPlan = planExportAudio(project, entry.durationInFrames);
  if (!audioPlan) return { notes: [AUDIO_STANDARD_PATH_NOTE] };
  if (!audioPlan.segments.some((s) => s.kind === 'source')) return { audioPath: videoPath, notes: [] };

  const wavPath = path.join(workDir, 'audio.wav');
  const graphPath = path.join(workDir, 'audio-graph.txt');
  const pass = audioPassArgs(audioPlan, wavPath, graphPath);
  await fs.writeFile(graphPath, pass.graph, 'utf-8');
  await runFfmpeg(ffmpeg, pass.args, { signal });
  const notes = audioPlan.chains ? [`Mixed ${audioPlan.chains.length + 1} audio chains in the one pass.`] : [];

  const aacPath = path.join(workDir, 'audio.m4a');
  await encodeExportAudio({ audioPath: wavPath, outputPath: aacPath, signal });
  await fs.rm(wavPath, { force: true }).catch(() => {});
  return { audioPath: aacPath, notes };
}
