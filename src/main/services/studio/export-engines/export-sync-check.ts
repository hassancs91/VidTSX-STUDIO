/**
 * T8 "Check this export" (END_TO_END_PLAN §2): the user-facing A/V check of a
 * finished export against the first camera clip's file, with verify_sync's
 * verdict. Probes are placed where the camera picture is visible
 * (`planSyncProbes`); per probe the export's 2 s audio window is located in
 * the camera audio within ±2 s of where the timeline says it should be, then
 * the export's frame (only the camera's visible box) is located among 96
 * camera frames centred between the audio's and the timeline's time, each
 * labelled by its own timestamp. The report JSON (version 2) is written
 * beside the export (`<name>.sync.json`).
 */
import fs from 'fs/promises';
import path from 'path';
import type { StudioProject } from '../../../../shared/types/studio';
import { planSyncProbes, SYNC_WINDOW_SEC, type SyncProbe, type SyncReference, type SyncSkip } from '../../../../shared/studio/sync-probes';
import { SYNC_DRIFT_LIMIT_MS, SYNC_MIN_PROBES, SYNC_TOLERANCE_MS, syncVerdict, type SyncVerdict } from '../../../../shared/studio/sync-verdict';
import { getFfmpegBinary } from '../ffmpeg-bin';
import {
  SYNC_AUDIO_RATE,
  SYNC_AUDIO_SEARCH_SEC,
  SYNC_FRAME_BEFORE_SEC,
  SYNC_FRAME_COUNT,
  SYNC_MIN_AUDIO_QUALITY,
  SYNC_MIN_MATCH,
  SYNC_MASK_MIN_FRACTION,
  SYNC_MASK_RESIDUAL,
  classifyProbe,
  cropScaleFilter,
  exactFrameSeek,
  layoutMask,
  locateAudio,
  matchFrame,
  rms,
  sourceFrameWindow,
  thumbSize,
  type DecodedFrameTime,
  type FrameMatch,
  type SyncProbeStatus,
} from './sync-measure';
import { decodeAudioSpan, decodeWholeAudio, grabGrayFrames, probeMedia, type MediaFacts } from './sync-media';

export interface SyncCheckProgress {
  done: number;
  total: number;
}

export interface SyncCheckOptions {
  exportPath: string;
  /** The document the export was rendered from (a range export's trimmed one, t = 0 at the range start). */
  project: StudioProject;
  /** Default: beside the export, `<name>.sync.json`. */
  reportPath?: string;
  ffmpeg?: string;
  ffprobe?: string;
  minMatch?: number;
  signal?: AbortSignal;
  onProgress?: (progress: SyncCheckProgress) => void;
}

export interface SyncProbeRow {
  t: number;
  frame: number;
  clipId: string;
  /** Where the timeline puts this moment in the camera file. */
  plannedSourceSec: number;
  overlays: string[];
  windowRms: number;
  audio: { sec: number; quality: number } | null;
  /**
   * `sec`/`frame` are the matched camera frame's OWN timestamp (never `first + index`); `exportSec` the
   * export frame's. `quality` is the decisive match (over the layout mask when there is one); `plainQuality` the whole-box pass 1.
   */
  video: { sec: number; frame: number; exportSec: number; quality: number; plainQuality: number; maskShare: number | null } | null;
  status: SyncProbeStatus;
  errorMs: number | null;
}

export interface SyncCheckReport {
  version: 2;
  file: string;
  checkedAt: string;
  settings: {
    audioRate: number;
    windowSec: number;
    audioSearchSec: number;
    minAudioQuality: number;
    minMatch: number;
    frameBeforeSec: number;
    frameCount: number;
    toleranceMs: number;
    driftLimitMs: number;
    minProbes: number;
    maskResidual: number;
    maskMinFraction: number;
  };
  export: MediaFacts;
  reference: (SyncReference & { fps: number }) | null;
  visibleSec: number;
  skipped: SyncSkip[];
  probes: SyncProbeRow[];
  verdict: SyncVerdict;
  elapsedMs: number;
}

export function syncReportPath(exportPath: string): string {
  const parsed = path.parse(exportPath);
  return path.join(parsed.dir, `${parsed.name}.sync.json`);
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

interface ProbeContext {
  ffmpeg: string;
  exportPath: string;
  exportFacts: MediaFacts;
  exportPcm: Float32Array;
  reference: SyncReference;
  referenceFps: number;
  /** Camera px in the plan → the reference file's real px (1 unless the document's probe is stale). */
  referenceScale: { x: number; y: number };
  minMatch: number;
  signal?: AbortSignal;
}

/** One probe after the I/O: its audio location and, when that worked, the frames to match. */
interface ProbeReads {
  probe: SyncProbe;
  windowRms: number;
  audio: SyncProbeRow['audio'];
  pictures: { target: Uint8Array; targetSec: number; frames: Uint8Array[]; times: DecodedFrameTime[]; plain: FrameMatch } | null;
}

async function readProbe(probe: SyncProbe, ctx: ProbeContext): Promise<ProbeReads> {
  const windowLength = Math.round(SYNC_WINDOW_SEC * SYNC_AUDIO_RATE);
  const at = Math.round(probe.t * SYNC_AUDIO_RATE);
  const needle = ctx.exportPcm.subarray(at, at + windowLength);
  const windowRms = needle.length === windowLength ? rms(needle) : 0;

  let audio: SyncProbeRow['audio'] = null;
  if (windowRms > 0) {
    const hayStart = Math.max(0, probe.sourceSec - SYNC_AUDIO_SEARCH_SEC);
    const hay = await decodeAudioSpan(ctx.ffmpeg, ctx.reference.path, hayStart, SYNC_WINDOW_SEC + 2 * SYNC_AUDIO_SEARCH_SEC, ctx.signal);
    const found = locateAudio(needle, hay);
    if (found) audio = { sec: r4(hayStart + found.lag / SYNC_AUDIO_RATE), quality: r3(found.quality) };
  }
  if (!audio) return { probe, windowRms, audio, pictures: null };

  const thumb = thumbSize(probe.exportRect);
  const exported = await grabGrayFrames(
    ctx.ffmpeg, ctx.exportPath, exactFrameSeek(probe.frame, ctx.exportFacts.fps), 1, cropScaleFilter(probe.exportRect, thumb), thumb, ctx.signal,
  );
  const src = probe.sourceRect;
  const { x: sx, y: sy } = ctx.referenceScale;
  const sourceRect = { x: Math.round(src.x * sx), y: Math.round(src.y * sy), width: Math.round(src.width * sx), height: Math.round(src.height * sy) };
  const window = sourceFrameWindow((audio.sec + probe.sourceSec) / 2, ctx.referenceFps);
  const { frames, times } = await grabGrayFrames(ctx.ffmpeg, ctx.reference.path, window.seekSec, window.count, cropScaleFilter(sourceRect, thumb), thumb, ctx.signal);
  const [target] = exported.frames;
  if (!target || frames.length === 0) return { probe, windowRms, audio, pictures: null };
  return { probe, windowRms, audio, pictures: { target, targetSec: exported.times[0].sec, frames, times, plain: matchFrame(target, frames) } };
}

const rectKey = (probe: SyncProbe) => JSON.stringify([probe.exportRect, probe.sourceRect]);

/**
 * Pass 2: probes that share a box get one layout mask (where the camera is
 * really visible, from all their pass-1 residuals) and are matched again over
 * it; a box with fewer than 3 probes keeps the plain whole-box match.
 */
function finishProbes(reads: ProbeReads[], ctx: ProbeContext): SyncProbeRow[] {
  const masks = new Map<string, Uint8Array | null>();
  for (const read of reads) {
    const key = rectKey(read.probe);
    if (masks.has(key)) continue;
    const pairs = reads.flatMap((r) => (r.pictures && rectKey(r.probe) === key ? [{ target: r.pictures.target, best: r.pictures.frames[r.pictures.plain.index] }] : []));
    masks.set(key, layoutMask(pairs));
  }
  return reads.map(({ probe, windowRms, audio, pictures }) => {
    let video: SyncProbeRow['video'] = null;
    if (pictures) {
      const mask = masks.get(rectKey(probe)) ?? null;
      const best = mask ? matchFrame(pictures.target, pictures.frames, mask) : pictures.plain;
      const { sec } = pictures.times[best.index];
      video = {
        sec: r4(sec),
        frame: Math.round(sec * ctx.referenceFps),
        exportSec: r4(pictures.targetSec),
        quality: r3(best.quality),
        plainQuality: r3(pictures.plain.quality),
        maskShare: mask ? r3(mask.reduce((a, b) => a + b, 0) / mask.length) : null,
      };
    }
    const outcome = classifyProbe({ windowRms, audio, video }, { minMatch: ctx.minMatch });
    return {
      t: probe.t,
      frame: probe.frame,
      clipId: probe.clipId,
      plannedSourceSec: probe.sourceSec,
      overlays: probe.overlays,
      windowRms: r4(windowRms),
      audio,
      video,
      status: outcome.status,
      errorMs: outcome.status === 'ok' ? outcome.errorMs : null,
    };
  });
}

function settingsOf(minMatch: number): SyncCheckReport['settings'] {
  return {
    audioRate: SYNC_AUDIO_RATE,
    windowSec: SYNC_WINDOW_SEC,
    audioSearchSec: SYNC_AUDIO_SEARCH_SEC,
    minAudioQuality: SYNC_MIN_AUDIO_QUALITY,
    minMatch,
    frameBeforeSec: SYNC_FRAME_BEFORE_SEC,
    frameCount: SYNC_FRAME_COUNT,
    toleranceMs: SYNC_TOLERANCE_MS,
    driftLimitMs: SYNC_DRIFT_LIMIT_MS,
    minProbes: SYNC_MIN_PROBES,
    maskResidual: SYNC_MASK_RESIDUAL,
    maskMinFraction: SYNC_MASK_MIN_FRACTION,
  };
}

function withMessage(verdict: SyncVerdict, message: string): SyncVerdict {
  return { ...verdict, message };
}

export async function checkExportSync(options: SyncCheckOptions): Promise<{ report: SyncCheckReport; reportPath: string }> {
  const started = Date.now();
  const ffmpeg = options.ffmpeg ?? (await getFfmpegBinary('ffmpeg'));
  const ffprobe = options.ffprobe ?? (await getFfmpegBinary('ffprobe'));
  const minMatch = options.minMatch ?? SYNC_MIN_MATCH;
  const exportFacts = await probeMedia(ffprobe, options.exportPath, options.signal);
  const plan = planSyncProbes(options.project, {
    durationSec: exportFacts.durationSec,
    fps: exportFacts.fps,
    output: { width: exportFacts.width, height: exportFacts.height },
  });

  const rows: SyncProbeRow[] = [];
  let reference: SyncCheckReport['reference'] = null;
  let verdict: SyncVerdict;

  if (!plan.reference) {
    verdict = withMessage(syncVerdict([], 0), 'Nothing to check against: this export has no camera clip with sound at normal speed.');
  } else if (!exportFacts.hasAudio) {
    verdict = withMessage(syncVerdict([], plan.probes.length), 'Nothing to check: the exported file has no audio track.');
  } else {
    const refFacts = await probeMedia(ffprobe, plan.reference.path, options.signal);
    reference = { ...plan.reference, fps: refFacts.fps };
    const exportPcm = await decodeWholeAudio(ffmpeg, options.exportPath, options.signal);
    const ctx: ProbeContext = {
      ffmpeg,
      exportPath: options.exportPath,
      exportFacts,
      exportPcm,
      reference: plan.reference,
      referenceFps: refFacts.fps,
      referenceScale: { x: refFacts.width / plan.reference.width, y: refFacts.height / plan.reference.height },
      minMatch,
      signal: options.signal,
    };
    options.onProgress?.({ done: 0, total: plan.probes.length });
    const reads: ProbeReads[] = [];
    for (const probe of plan.probes) {
      if (options.signal?.aborted) throw new Error('Sync check cancelled');
      reads.push(await readProbe(probe, ctx));
      options.onProgress?.({ done: reads.length, total: plan.probes.length });
    }
    rows.push(...finishProbes(reads, ctx));
    const confident = rows.flatMap((row) => (row.errorMs === null ? [] : [{ t: row.t, errorMs: row.errorMs }]));
    const count = (status: SyncProbeStatus) => rows.filter((row) => row.status === status).length;
    const misses = { silent: count('silent'), lowAudio: count('low-audio'), lowVideo: count('low-video') };
    verdict = plan.probes.length === 0
      ? withMessage(syncVerdict([], 0), 'Nothing to check: the camera picture is never visible long enough in this export.')
      : syncVerdict(confident, plan.probes.length, { misses, audioSearchSec: SYNC_AUDIO_SEARCH_SEC });
  }

  const report: SyncCheckReport = {
    version: 2,
    file: options.exportPath,
    checkedAt: new Date().toISOString(),
    settings: settingsOf(minMatch),
    export: exportFacts,
    reference,
    visibleSec: plan.visibleSec,
    skipped: plan.skipped,
    probes: rows,
    verdict,
    elapsedMs: Date.now() - started,
  };
  const reportPath = options.reportPath ?? syncReportPath(options.exportPath);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  return { report, reportPath };
}
