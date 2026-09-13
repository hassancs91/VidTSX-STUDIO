/**
 * Hidden dev verification mode (docs/export-engines-plan.md D5): the same
 * export runs through a second engine and both finished files are measured
 * with the T1 instruments — per-frame pixel diff at the first/last frame, the
 * thirds and every cut (± 1 frame), the audio offset between the two files,
 * and the audio offset against the first clip's camera file (D6: the source
 * is the 0 ms reference). Report JSON + side-by-side stills land beside the
 * export. Every future engine is checked with this same instrument.
 */
import fs from 'fs/promises';
import path from 'path';
import { getFfmpegBinary } from '../ffmpeg-bin';
import type { StudioProject } from '../../../../shared/types/studio';
import type { ExportEngineId } from '../../../../shared/studio/export-engines';
import { audioOffsetRows, decodePcm, type AudioOffsetRow } from './audio-offset';
import { diffRgb24, extractFrameRgb24, sampleFrames, writeSideBySide, type FrameDiffRow } from './frame-diff';
import { finishExport } from './finishing';
import { exportOutputSize } from './output-size';
import { resolveExportEngine } from './registry';
import type { ExportColorPolicy, ExportRenderSettings } from './types';
import type { StudioExportEntry } from '../export-entry';

export interface VerifyExportOptions {
  jobId: string;
  project: StudioProject;
  entry: StudioExportEntry;
  bundleUrl: string;
  workDir: string;
  render: ExportRenderSettings;
  color: ExportColorPolicy;
  signal: AbortSignal;
  candidate: { engineId: ExportEngineId; outputPath: string };
  referenceEngineId: ExportEngineId;
  /** The one audio pass, shared by both files. */
  audioPath: string;
  onProgress: (fraction: number, message: string) => void;
}

export interface ExportVerifyReport {
  candidateEngine: ExportEngineId;
  referenceEngine: ExportEngineId;
  candidatePath: string;
  referencePath: string;
  frames: FrameDiffRow[];
  audio: {
    vsReference: AudioOffsetRow[];
    vsSource?: { assetPath: string; clipStart: number; sourceIn: number; rows: AudioOffsetRow[] };
  };
  summary: { maxPctOver24: number; maxMeanAbsDiff: number; maxAbsLagMs: number | null; sourceMaxAbsLagMs: number | null };
  stillsDir: string;
  at: string;
}

/** Pure: frame indices of every clip start on the video tracks, except 0. */
export function cutFramesOf(project: StudioProject, fps: number): number[] {
  const cuts = new Set<number>();
  for (const track of project.timeline.tracks) {
    if (track.kind !== 'video') continue;
    for (const clip of track.clips) {
      const f = Math.round(clip.timelineStart * fps);
      if (f > 0) cuts.add(f);
    }
  }
  return [...cuts].sort((a, b) => a - b);
}

/** Pure: the first video clip with a source asset — the D6 audio reference. */
export function sourceReferenceOf(project: StudioProject): { assetPath: string; clipStart: number; sourceIn: number; duration: number } | null {
  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const clips = project.timeline.tracks
    .filter((t) => t.kind === 'video')
    .flatMap((t) => t.clips)
    .filter((c) => c.kind === 'video' && c.assetId && (c.speed ?? 1) === 1)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  for (const clip of clips) {
    const asset = clip.assetId ? byId.get(clip.assetId) : undefined;
    if (!asset || !asset.probe?.hasAudio) continue;
    return { assetPath: asset.path, clipStart: clip.timelineStart, sourceIn: clip.sourceIn ?? 0, duration: clip.duration };
  }
  return null;
}

/** Pure: window starts (seconds) inside [start, start+duration), clear of both ends. */
export function windowsWithin(start: number, duration: number): number[] {
  const usable = duration - 1.5;
  if (usable <= 0.5) return [];
  const picks = [0.5, usable / 2, usable];
  return [...new Set(picks.map((p) => Math.round((start + p) * 10) / 10))];
}

function summarize(frames: FrameDiffRow[], vsRef: AudioOffsetRow[], vsSrc?: AudioOffsetRow[]) {
  const lags = (rows: AudioOffsetRow[]) => rows.filter((r) => !r.skipped && r.lagMs !== undefined).map((r) => Math.abs(r.lagMs ?? 0));
  const refLags = lags(vsRef);
  const srcLags = vsSrc ? lags(vsSrc) : [];
  return {
    maxPctOver24: frames.reduce((m, r) => Math.max(m, r.pctOver24), 0),
    maxMeanAbsDiff: frames.reduce((m, r) => Math.max(m, ...r.meanAbsDiff), 0),
    maxAbsLagMs: refLags.length ? Math.max(...refLags) : null,
    sourceMaxAbsLagMs: vsSrc ? (srcLags.length ? Math.max(...srcLags) : null) : null,
  };
}

export function summaryLine(report: ExportVerifyReport): string {
  const s = report.summary;
  const audio = s.maxAbsLagMs === null ? 'n/a' : `${s.maxAbsLagMs} ms`;
  const source = s.sourceMaxAbsLagMs === null ? '' : `, vs camera ${s.sourceMaxAbsLagMs} ms`;
  return `Verified against "${report.referenceEngine}": ${report.frames.length} frames, max ${s.maxPctOver24} % of pixels over 24, max mean ${s.maxMeanAbsDiff}/255; audio vs reference ${audio}${source}.`;
}

export async function verifyExport(options: VerifyExportOptions): Promise<{ report: ExportVerifyReport; reportPath: string }> {
  const { entry, signal } = options;
  const base = options.candidate.outputPath.replace(/\.mp4$/i, '');
  const referencePath = `${base}.verify-${options.referenceEngineId}.mp4`;
  const stillsDir = `${base}.verify`;
  await fs.mkdir(stillsDir, { recursive: true });

  // 1. The reference export, through the same finishing stage and audio.
  const refEngine = resolveExportEngine(options.referenceEngineId);
  const refWork = path.join(options.workDir, 'verify');
  await fs.mkdir(refWork, { recursive: true });
  const product = await refEngine.produce({
    jobId: `${options.jobId}:verify`,
    project: options.project,
    entry,
    bundleUrl: options.bundleUrl,
    workDir: refWork,
    render: options.render,
    color: options.color,
    signal,
    onProgress: (p) => options.onProgress((p.totalFrames ? p.framesDone / p.totalFrames : 0) * 0.7, 'Rendering the reference export…'),
  });
  options.onProgress(0.7, 'Finishing the reference export…');
  await finishExport({ videoPath: product.videoPath, videoDemuxer: product.videoDemuxer, expectedFrames: product.frames, audioPath: options.audioPath, outputPath: referencePath, color: options.color, signal });

  // 2. Pixel diff at the sampled frames.
  const ffmpeg = await getFfmpegBinary('ffmpeg');
  const frames = sampleFrames(entry.durationInFrames, cutFramesOf(options.project, entry.fps));
  // Both files are at the export's output size (a scaled export is diffed at that size).
  const size = exportOutputSize(entry, options.render);
  const pixels = size.width * size.height;
  const rows: FrameDiffRow[] = [];
  for (let i = 0; i < frames.length; i++) {
    const n = frames[i];
    options.onProgress(0.8 + (i / frames.length) * 0.15, `Comparing frame ${n}…`);
    const [a, b] = await Promise.all([
      extractFrameRgb24(ffmpeg, options.candidate.outputPath, n, entry.fps, signal),
      extractFrameRgb24(ffmpeg, referencePath, n, entry.fps, signal),
    ]);
    const diff = Buffer.alloc(pixels * 3);
    rows.push({ frame: n, ...diffRgb24(a, b, pixels, diff) });
    await writeSideBySide(ffmpeg, { a, b, diff, width: size.width, height: size.height }, path.join(stillsDir, `f${n}.png`), signal);
  }

  // 3. Audio: the two files against each other, and the candidate against the camera file.
  options.onProgress(0.95, 'Measuring audio offset…');
  const durationSec = entry.durationInFrames / entry.fps;
  const [candPcm, refPcm] = await Promise.all([
    decodePcm(ffmpeg, options.candidate.outputPath, signal),
    decodePcm(ffmpeg, referencePath, signal),
  ]);
  const vsReference = audioOffsetRows(refPcm, candPcm, windowsWithin(0, durationSec));
  let vsSource: ExportVerifyReport['audio']['vsSource'];
  const source = sourceReferenceOf(options.project);
  if (source) {
    try {
      const sourcePcm = await decodePcm(ffmpeg, source.assetPath, signal);
      // Reference = the camera file: window w in source time; the export sits at w − (sourceIn − clipStart).
      const clipEnd = Math.min(source.clipStart + source.duration, durationSec);
      const exportWindows = windowsWithin(source.clipStart, clipEnd - source.clipStart);
      const bOffset = source.sourceIn - source.clipStart;
      const sourceWindows = exportWindows.map((w) => Math.round((w + bOffset) * 10) / 10);
      vsSource = { assetPath: source.assetPath, clipStart: source.clipStart, sourceIn: source.sourceIn, rows: audioOffsetRows(sourcePcm, candPcm, sourceWindows, bOffset) };
    } catch {
      vsSource = undefined;
    }
  }

  const report: ExportVerifyReport = {
    candidateEngine: options.candidate.engineId,
    referenceEngine: options.referenceEngineId,
    candidatePath: options.candidate.outputPath,
    referencePath,
    frames: rows,
    audio: { vsReference, vsSource },
    summary: summarize(rows, vsReference, vsSource?.rows),
    stillsDir,
    at: new Date().toISOString(),
  };
  const reportPath = `${base}.verify.json`;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  options.onProgress(1, 'Verified.');
  return { report, reportPath };
}
